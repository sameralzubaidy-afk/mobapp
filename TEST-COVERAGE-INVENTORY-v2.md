# TEST-COVERAGE-INVENTORY-v2

> **Ground-truth QA test-coverage inventory (v2 — no cutoff).** Every captured QA report on disk through **2026-09-03** cross-referenced against the current canonical guide index. **Read-only reconciliation** — no guides, code, or reports were modified. Successor to `TEST-COVERAGE-INVENTORY.md` (generated 2026-08-24), which is superseded by evidence created after that date (TRD Groups S–Z, ACC closures, MSG/SUB live rounds, QA Tasks 5–25).

**Generated:** 2026-09-03

## 1 · Executive summary

- **Canonical test cases (unique TC-IDs across the 6 guides, as of today):** **833** (guide index has grown since v1: TRD 278→288 [Groups N2/O1–O3/S–Z added], ACC 73→75, ADM 159→160).
- **Have real QA evidence on record (any verdict, incl. PARTIAL/SKIPPED):** **583**
- **Latest verdict PASS:** **486** · **Latest PARTIAL:** **41**
- **STILL OPEN** (latest FAIL/BLOCKED with no later PASS re-verification): **47**
- **DOC-DRIFT** (guide assertion obsolete; backend verified): **3**
- **NEVER RUN** (no report on disk asserts a verdict under the canonical ID): **250**

| Guide | Cases | Run | PASS (latest) | PARTIAL | STILL OPEN | DOC-DRIFT | NEVER RUN |
|---|---:|---:|---:|---:|---:|---:|---:|
| AUTH (Signup→Discovery) | 138 | 138 | 118 | 2 | 16 | 0 | 0 |
| MSG (Messaging→Notifications) | 72 | 58 | 47 | 6 | 5 | 0 | 14 |
| TRD (TradeFlowV2) | 288 | 269 | 234 | 28 | 2 | 3 | 19 |
| ACC (Account/Dashboard/Help/Legal) | 75 | 75 | 57 | 0 | 17 | 0 | 0 |
| ADM (Admin Portal) | 160 | 1 | 0 | 0 | 0 | 0 | 159 |
| SUB (Subscriptions/Payouts/SP Wallet) | 100 | 42 | 30 | 5 | 7 | 0 | 58 |

**Key facts**

- **TRD went from 0-run (v1) to the most-covered guide on disk.** Manual TradeFlowV2 evidence now spans QA Tasks 1–18 (2026-08-26 → 2026-09-02): Groups A–D (core/offer lifecycle/SP/timers), E–K (disputes/payout/reminders/CTAs/safety/seller-cancel/fees), L–M (bundle/cart), N/N2 (min-price + idempotency), O/P (tax), Q (reviews), R (refund settlement), S–T (more-from-seller/points), U–Y (nav/copy/admin-trades/list/timeline), Z (cancel-request & escalation).
- **AUTH** remains fully executed (138/138) with 118 PASS (+2 PARTIAL); the 16 still-open are dominated by fixture/config/doc-drift blocks (Q04 stale-guide fee assertion, etc.).
- **ACC** (Account/Dashboard/Help/Legal) was closed 2026-08-24…08-26 by the `account-file-*` closures (postdates v1): 57 PASS, 17 still-open (email/SMS env-gated, legal-email stall).
- **MSG** went live 2026-09-02/03 (QA Task 19/24/25): 47 PASS + 6 partial; the 5 BLOCKED are MSG G01–G04/G06/G07 — a **confirmed 09-03 app bug** (Safety Review cannot load `status != 'available'` listings, `getListingById` available-only filter) and MSG B05.
- **SUB** (Subscriptions/Payouts/SP Wallet) went live 2026-09-02/03: 30 PASS + 5 partial; 7 open (D06/D07/E02/I08/J03/J04 fixture/config; SUB E03 = 09-03 FAIL-finding: FAILED-badge renders but `error_message` never shown).
- **ADM** (Admin Portal guide) is still essentially **uncovered by manual QA** (159/160 NEVER RUN). Its admin behaviors are only exercised indirectly (automated legacy suite + TRD/SUB admin-dependency legs).
- The full source register (report.md + decision logs + results.json parsed: **124 files / 1362 evidence rows**) is summarized in §5.

### TRD P1 (SP-settlement trigger) — status: **RESOLVED (2026-08-28)**

The 2026-08-28 Group A/B run's P1 — migration `20260715000001` dropped `fn_release_all_sp_on_complete() CASCADE`, destroying `trigger_release_all_sp_on_complete` so SP never settled at completion (A02 FAIL) — was **fixed and re-verified the same day**:
- **Fix:** `supabase/migrations/20260828000001_recreate_sp_release_trigger_and_reconcile.sql` (Dev Task 17 revised) recreates the trigger on `public.trades` and reconciles staging stuck balances.
- **Re-verify:** `qa-trd-reverify-a02-b02-b06-2026-08-28` → **TRD-TC-A02 PASS** (buyer reserved 18→10, seller pending +17, `sp_ledger` spend_purchase/earn_reward pair, `pending_sp_release_at` set).
- **Sustained:** every later SP-trade run re-confirms release-at-completion (qa-task8 flow-1 earn_reward +6; qa-task16 T06; qa-task18 Z05 releasing 28 SP on both bundle siblings). Later migrations (20260828000002, 20260830000001/015) re-create the function and keep the trigger.
- **Not still open.** No QA report after 2026-08-28 asserts the SP-settlement trigger is missing. (The same run's P1/P2 Stripe re-offer idempotency collision was separately fixed by DT-18 on 2026-08-28.)

## 2 · Method (read-only reconciliation, no date cutoff)

1. **Step 1 — Guides:** re-parsed the `## Test Case Index` of all 6 canonical files (`cross-checked-and-consolidated/`) as of today (index rows → unique IDs: AUTH 138 · MSG 72 · TRD 288 · ACC 75 · ADM 160 · SUB 100 = **833**).
2. **Step 2 — Evidence (no cutoff):** scanned the whole repo for QA-run evidence created through 2026-09-03 — `e2e-test-results/**/report.md`, `*decision*outcome*log*` files, `results.json`, and `test-automation/trade-flow-v2/reports/**` (124 files; legacy automated runs kept separate). Extracted per-case verdicts across all report formats.
3. **Step 3 — TRD reconciliation (curated):** the automated parser cannot faithfully read flow/DT-based TRD reports (no `TRD-TC-` literals) and mis-reads 'original → latest' tables, so **every TRD verdict was curated by reading the 19 TRD execution reports directly** (trd-a01-a02, trd-part2, qa-trd-group-a-b/b-c-d-e/b05e-j-admin-deps/b01-b02-reverify/reverify-a02-b02-b06, qa-task5–18). Each row's verdict/date/source was taken from the report's own verdict table + DB read-back; FAIL/BLOCKED entries were checked against later re-verifications to find the latest truth.
4. **Step 4 — Other guides (auto + light check):** AUTH/MSG/ACC/ADM/SUB latest verdicts come from the automated reconcile `(date, wall-clock, kind-priority, path)`; MSG/SUB/ACC were spot-validated against the newest consolidated reports (qa-task19–25, account-file-*).
5. **Scope limits (as v1):** manual verdicts drive the canonical rows. Legacy automated-suite runs (May–Jun 2026, `TC-A01`/`REG-R01` scheme, incl. 4 `2026-08-27T*` results.json runs) are **not** merged (they use a pre-prefix scheme and several were harness-broken all-fail) — see §6. TRD cases whose only evidence is the legacy scheme are counted NEVER RUN, per the method.

## 3 · Canonical coverage by guide

Columns: **Latest** = latest verdict on record · **Date** = date of that verdict · **Source** = run folder of the latest evidence · **Status** = `✅ PASS` / `🟡 PARTIAL` / `🔴 STILL OPEN` / `⏭️ SKIPPED` / `📄 DOC-DRIFT` / `NEVER RUN`.

### AUTH (Signup→Discovery) — 138 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|
| AUTH-TC-A01 | Successful signup with valid details |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A02 | Field validation errors (name/email/phone/password) |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A03 | Password mismatch + weak password |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A04 | Under-18 date of birth blocked |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A05 | Duplicate email blocked |  | PASS | 2026-08-23 | `spotcheck-sweeps-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A06 | Optional referral code (valid / invalid handling) |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A07 | Terms of Service & Privacy Policy links |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-A08 | Landing footer legal links (Terms / Privacy Policy) |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B01 | Successful login routes by onboarding status |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B02 | Invalid credentials error |  | PASS | 2026-08-23 | `spotcheck-sweeps-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B03 | Forgot Password link |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B04 | Session restore after app kill/relaunch |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B05 | App resume refreshes silently (no spinner) |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B06 | Cold launch does not hang on spinner |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B07 | Empty-field + invalid-email inline validation |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B08 | ACCOUNT_DELETED login branch |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B09 | PROFILE_NOT_FOUND login branch |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B10 | Back button returns to previous screen |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B11 | Sign Up footer link |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-B12 | Log In footer link (Create Account) |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-C01 | Sign in / Continue with Google |  | PASS | 2026-08-16 | `phase21-auth-group-c01-google-2026-08-16` | ✅ PASS |  |
| AUTH-TC-C02 | Sign in / Continue with Facebook |  | PASS | 2026-08-16 | `phase20-auth-group-c-closure-2026-08-16` | ✅ PASS |  |
| AUTH-TC-C03 | Sign in / Continue with Apple (iOS + Android) |  | BLOCKED | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-C04 | Existing-email account-link prompt |  | PASS | 2026-08-19 | `qa-final-verify-e05-c04-2026-08-19` | ✅ PASS |  |
| AUTH-TC-C05 | Provider unavailable → email fallback banner |  | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-C06 | User cancels OAuth — silent return |  | PASS | 2026-08-16 | `phase19-auth-group-c-closeout-2026-08-16` | ✅ PASS |  |
| AUTH-TC-C07 | Social-only user sets a password |  | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-D01 | Logout from Profile with confirmation |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-D02 | Sign Out from Settings |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-D03 | After logout, app returns to Landing |  | PASS | 2026-08-23 | `group-a-b-d-auth-2026-08-23` | ✅ PASS |  |
| AUTH-TC-E01 | OTP screen sends + verifies 6-digit code |  | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | ✅ PASS |  |
| AUTH-TC-E02 | Incomplete / invalid / expired code errors |  | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | ✅ PASS |  |
| AUTH-TC-E03 | Resend cooldown (60s) |  | PASS | 2026-08-17 | `phase22-auth-group-b-d-e-2026-08-17` | ✅ PASS |  |
| AUTH-TC-E04 | OTP rate limiting message |  | PASS | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | ✅ PASS |  |
| AUTH-TC-E05 | Gate blocks first listing until verified |  | PASS | 2026-08-19 | `qa-final-verify-e05-c04-2026-08-19` | ✅ PASS |  |
| AUTH-TC-F01 | Active ZIP → assigned to node, no waitlist |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-F02 | Inactive ZIP → "We're Coming Soon!" + Join Waitlist |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-F03 | Waitlist confirmation + fallback node access |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-F04 | Continue Trading without joining waitlist |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-F05 | ZIP auto-lookup shows city/state |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-F06 | Node-scoped content (My Node vs Show All Nodes) |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-G01 | Admin creates an active node (ZIP auto-lookup) |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-G02 | Admin creates an inactive node |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-G03 | Admin edits a node |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-G04 | Admin deactivates a node with members (warning) |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-G05 | Admin reactivates a node |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-G06 | Node stats cards + validation |  | PASS | 2026-08-23 | `group-fg-nodes-zip-gating-2026-08-23` | ✅ PASS |  |
| AUTH-TC-H01 | Profile Setup: avatar + display name + ZIP |  | PASS | 2026-08-24 | `group-j-h-closure-2026-08-24` | ✅ PASS |  |
| AUTH-TC-H02 | Profile Setup validation errors |  | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` | ✅ PASS |  |
| AUTH-TC-H03 | Avatar upload failure does not block |  | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-H04 | ~~Welcome screen → Get Started~~ (REMOVED — screen deleted; superseded by H06/H07) |  | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-H05 | ~~Feature Highlights carousel~~ (REMOVED — screen deleted; superseded by H06/H07) |  | BLOCKED | 2026-08-23 | `group-h-profile-setup-2026-08-23` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-H06 | Onboarding carousel: Next / Skip / Get Started |  | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` | ✅ PASS |  |
| AUTH-TC-H07 | Onboarding completion routes to Home |  | PASS | 2026-08-23 | `group-h-profile-setup-2026-08-23` | ✅ PASS |  |
| AUTH-TC-I01 | ~~Start Free Trial enrolls Kids Club+~~ (REMOVED — no in-app trial-choice step; subscription purchase superseded by web-first `JoinKidsClubScreen` path) |  | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-I02 | ~~Continue Free stays on free tier~~ (REMOVED — post-Profile-Setup routes to EDU carousel → free-tier Home; no Continue Free step) |  | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-I03 | ~~Trial limit reached hides trial CTA~~ (REMOVED — no in-app trial CTA; trial disabled via `admin_config.trial_enabled=false`) |  | BLOCKED | 2026-08-23 | `group-i-subscription-choice-2026-08-23` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-J01 | Photo-first gating (fields hidden until 1 photo) |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J02 | AI auto-fill Apply All + per-field Use |  | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J03 | Required field validation |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J04 | Condition / Age Group / Gender / Color options |  | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J05 | "Other" category → custom name required |  | PASS | 2026-08-24 | `group-j-h-closure-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J06 | Payment preference — subscriber Accept SP toggle |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J07 | Payment preference — free user upgrade prompt |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J08 | SP earnings preview (subscriber) |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J09 | Submit for Review → pending + success modal |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J10 | Phone-verification gate before publish |  | PASS | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J11 | Draft auto-save + resume |  | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J12 | Listing photos — multiple upload, type and size validation |  | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J13 | Listing photos — remove, reorder, replace, and persist after resume |  | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J14 | Bonus category badge appears in picker and preview |  | PASS | 2026-08-24 | `group-j-listing-creation-single-2026-08-24` | ✅ PASS |  |
| AUTH-TC-J15 | Category-specific SP earn and buyer-cap preview recalculates |  | PASS | 2026-08-24 | `group-j-closure-j02-j04-j11-j12-j13-j15-2026-08-24` | ✅ PASS |  |
| AUTH-TC-K01 | Multi-photo upload + auto-grouping |  | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |  |
| AUTH-TC-K02 | Regroup / merge / move photos |  | PASS | 2026-08-20 | `phase27-groupk-ax-reverify-2026-08-20` | ✅ PASS |  |
| AUTH-TC-K03 | Step indicator: Photos → Group → Review → Publish |  | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |  |
| AUTH-TC-K04 | Apply to All bar (brand/condition/age/gender) |  | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |  |
| AUTH-TC-K05 | Submit N Items for Review + confirm sheet |  | PARTIAL | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | 🟡 PARTIAL |  |
| AUTH-TC-K06 | Bulk SP summary (subscriber) |  | PASS | 2026-08-19 | `phase25-auth-group-k-bulk-2026-08-19` | ✅ PASS |  |
| AUTH-TC-L01 | New listing not visible in feed until approved |  | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |  |
| AUTH-TC-L02 | Admin approves → item becomes visible |  | BLOCKED | 2026-08-21 | `group-l-playwright-l01-l04-2026-08-21` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-L03 | Seller receives approval notification |  | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |  |
| AUTH-TC-L04 | Editing an approved listing returns to pending |  | PASS | 2026-08-21 | `group-l-reverify-l01-l04-2026-08-21` | ✅ PASS |  |
| AUTH-TC-M01 | Search bar (debounced) + clear |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M02 | Recent searches + autocomplete |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M03 | Sort options |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M04 | Filters modal: SP toggle, Location/Category/Age, More Filters, live count |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M05 | "Accepts SP" quick-toggle (header ↔ sheet sync) |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M06 | Empty / no-results states |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M07 | Recent Searches chip row + Clear |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M08 | Trending in {State} section |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M09 | Result count + active filter chips (incl. gold SP chip) |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-M10 | Discover header: bookmark → Favorites (local header) |  | PASS | 2026-08-22 | `group-m-discover-2026-08-22` | ✅ PASS |  |
| AUTH-TC-N01 | Category browse filters results |  | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |  |
| AUTH-TC-N02 | Favorite heart toggle on item card |  | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |  |
| AUTH-TC-N03 | Infinite scroll pagination |  | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |  |
| AUTH-TC-N04 | "Accepts SP" badge on item card (gold, §6.7) |  | PASS | 2026-08-22 | `group-n-discovery-category-favorites-2026-08-22` | ✅ PASS |  |
| AUTH-TC-O01 | Results scoped to user's node |  | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |  |
| AUTH-TC-O02 | Location ZIP + radius filter |  | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |  |
| AUTH-TC-O03 | Inactive ZIP in filter → explicit waitlist opt-in (no auto-enroll) |  | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |  |
| AUTH-TC-O04 | Subscriber vs free SP visibility |  | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |  |
| AUTH-TC-O05 | Admin radius defaults and bounds reflect in Discover |  | PASS | 2026-08-22 | `group-o-node-scope-2026-08-22` | ✅ PASS |  |
| AUTH-TC-P01 | Header node chip shows registered market (read-only) |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P02 | Header right cluster: bell + chat + avatar; logout removed from header |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P03 | Header chat icon opens Messages with unread badge |  | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-P04 | Floating pill nav: order, margins, radius, shadow, safe area |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P05 | Inbox removed from nav; Messages via header chat only |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P06 | Trades tab: Active Trades (item, counterpart, status label) |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P07 | Trades tab: Trade History (reverse chronological) |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P08 | Trades badge counts active (not completed/cancelled) |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P09 | Basket badge + Home active state unchanged |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P10 | Post FAB globally visible + opens Sell sheet |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P11 | Composer bar: tap focuses, type, placeholder |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P12 | Composer "+" → New Item Photos step, Title pre-filled |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P13 | Composer empty submit → empty Title |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P14 | Composer camera → New Item straight to camera |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P15 | AI never overwrites composer-pre-filled Title |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P16 | FAB Sell sheet unchanged (parallel entry point) |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P17 | Logout still reachable from Profile/Settings |  | PASS | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | ✅ PASS |  |
| AUTH-TC-P18 | Composer analytics (tap + submit with/without text) |  | FAIL | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | 🔴 STILL OPEN | FAIL, unresolved |
| AUTH-TC-P19 | Accessibility identifiers (Trades tab, header chat) |  | FAIL | 2026-08-23 | `group-p-full-run-19-cases-2026-08-23` | 🔴 STILL OPEN | FAIL, unresolved |
| AUTH-TC-Q01 | Education Help screen — published sections only |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-Q02 | Education Help screen — section by type |  | PARTIAL | 2026-08-23 | `group-qs-calibration-2026-08-23` | 🟡 PARTIAL |  |
| AUTH-TC-Q03 | SP calculator — sell mode (no hardcoded rates) |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-Q04 | SP calculator — buy mode (cash + fee + cap) |  | FAIL | 2026-08-23 | `group-qs-calibration-2026-08-23` | 🔴 STILL OPEN | FAIL, unresolved |
| AUTH-TC-Q05 | SP calculator — bonus categories + example SP |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-Q06 | Education analytics — event tracking (no throw) |  | FAIL | 2026-08-23 | `group-qs-calibration-2026-08-23` | 🔴 STILL OPEN | FAIL, unresolved |
| AUTH-TC-Q07 | Education prompts — onboarding + in-app prompt state machine |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S01 | Forgot Password — success + Send Another Email |  | BLOCKED | 2026-08-24 | `auth-final-cleanup-batch-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| AUTH-TC-S02 | Forgot Password — invalid email |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S03 | Forgot Password — rate-limit error |  | SKIPPED | 2026-08-23 | `group-qs-calibration-2026-08-23` | ⏭️ SKIPPED |  |
| AUTH-TC-S04 | Forgot Password — SMTP-config (500) error |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S05 | Forgot Password — 400 error |  | SKIPPED | 2026-08-23 | `group-qs-calibration-2026-08-23` | ⏭️ SKIPPED |  |
| AUTH-TC-S06 | Forgot Password — Back to Login |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S07 | Reset Password — validation + requirements card |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S08 | Reset Password — success → Login |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S09 | Reset Password — link-error (expired) → Request New Reset Email |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S10 | Reset Password — no active reset session |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |
| AUTH-TC-S11 | Deep link `p2pkidsmarketplace://reset-password |  | PASS | 2026-08-23 | `group-qs-calibration-2026-08-23` | ✅ PASS |  |

### MSG (Messaging→Notifications) — 72 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|
| MSG-TC-A01 | Conversation list (search, unread badges, empty state) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-A02 | Open a chat thread + trade context banner |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-A03 | Send a text message + delivery status (sent→delivered→read) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-A04 | Receive a message in real time |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-A05 | Typing indicator |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-A06 | Send an image message + full-screen viewer |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-A07 | Message length limit (2000 chars) |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-A08 | Quick-reply meeting chips |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-A09 | Safety meeting banner + Learn more |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-A10 | Photo permission denied error |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-B01 | My Badges grid (earned vs locked) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-B02 | Badge detail modal |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-B03 | Badge showcase on profile |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-B04 | Badge celebration modal on unlock |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-B05 | 🚫 DEFERRED (post-MVP) — Leaderboard ranking (no in-app entry — deep-link/notification only) |  | BLOCKED | 2026-09-03 | `qa-msg-first-live-2026-09-03` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| MSG-TC-C01 | Submit a post-trade review (stars + comment) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-C02 | Rating required validation |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-C03 | Anonymous review |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-C04 | Skip review |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-C05 | Review display on seller profile + aggregate rating |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-C06 | Report a review (reviewee only) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-D01 | Start ID verification + upload from library |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-D02 | Capture ID with camera |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-D03 | Submit creates pending request |  | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | ✅ PASS |  |
| MSG-TC-D04 | Duplicate pending request blocked |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-D05 | No-image submit validation |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-D06 | Pending state screen |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-D07 | Approved → Verified badge on profile |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| MSG-TC-D08 | Rejected → reason shown + resubmit |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| MSG-TC-D09 | Submission confirmation notifications reach the user |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-D10 | Decision notifications honor channel preferences |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-E01 | Review queue (stats, filters, search) |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-E02 | Approve a request |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| MSG-TC-E03 | Reject with reason |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| MSG-TC-E04 | View completed request details |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| MSG-TC-E05 | Edit message templates |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| MSG-TC-E06 | New submission creates admin alert notification |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-F01 | View referral code + hero |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-F02 | Copy referral code |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-F03 | Share referral code (native share) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-F04 | Active rewards display |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-F05 | Referral history (pending vs completed) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-F06 | Enter referral code at signup |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-F07 | Program paused banner + disabled share |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-F08 | Admin configures referral rewards |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-G01 | Listing flagged → Safety Review screen |  | BLOCKED | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| MSG-TC-G02 | Appeal a flagged/rejected listing |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-G03 | Resubmit a "needs edits" listing |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-G04 | Remove a flagged listing |  | BLOCKED | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| MSG-TC-G05 | Recall safety alert notification |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-G06 | Appeal max-attempt limit follows admin config |  | BLOCKED | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| MSG-TC-G07 | Appeal window follows admin config |  | BLOCKED | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| MSG-TC-G08 | AI moderation toggle affects automated image review |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-G09 | Recall check toggle and threshold affect recall flagging |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-H01 | Flagged items moderation queue |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-H02 | Approve a flagged item |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-H03 | Reject with reason |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-H04 | Request edits |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-H05 | Trade dispute: mark under review |  | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | ✅ PASS |  |
| MSG-TC-H06 | Trade dispute: resolve complete / refund |  | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | ✅ PASS |  |
| MSG-TC-I01 | Enable push notifications |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-I02 | Push error states (Expo Go / web) |  | NEVER RUN |  |  | NEVER RUN |  |
| MSG-TC-I03 | Notification center list + icons |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-I04 | Tap notification → deep link + mark read |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-I05 | Mark all as read |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-I06 | Pagination + pull to refresh |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-I07 | Real-time arrival |  | PASS | 2026-09-03 | `qa-task24-msg-complete-2026-09-03` | ✅ PASS |  |
| MSG-TC-J01 | Category × channel toggles (live screen — 5 categories, no Safety) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-J02 | Default preferences (DB-driven, no hardcoded defaults) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-J03 | Always-on note (live footer copy) |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-J04 | Quiet hours (subscriber) + validation |  | PASS | 2026-09-03 | `qa-msg-first-live-2026-09-03` | ✅ PASS |  |
| MSG-TC-J05 | 🚫 NOT SUPPORTED — ID verification preference category (none exists) |  | NEVER RUN |  |  | NEVER RUN |  |

### TRD (TradeFlowV2) — 288 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|
| TRD-TC-A01 | Cash Only: full happy path (buyer confirms) |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | cash happy path; earlier 08-26 BLOCKED (EF v52), fixed v56 (trd-part2 08-27 PASS) |
| TRD-TC-A02 | Accept SP: SP entry at offer → seller accepts → buyer confirms |  | PASS | 2026-08-28 | `qa-trd-reverify-a02-b02-b06-2026-08-28` | ✅ PASS | Accept-SP happy path; 08-28 P1 SP-settlement FAIL then PASS after trigger recreated (migration 20260828000001) |
| TRD-TC-A03 | Accept SP: Pay Cash (0 SP) — subscriber seller still earns SP |  | NEVER RUN |  |  | NEVER RUN | Accept SP listing (buyer 0 SP, subscriber seller earns SP) — no run on disk |
| TRD-TC-A04 | Donate listing: [Claim] button, no charge |  | NEVER RUN |  |  | NEVER RUN | Donate listing [Claim] — no run on disk |
| TRD-TC-B01 | Seller declines offer |  | PASS | 2026-08-28 | `qa-trd-b01-b02-reverify-2026-08-28` | ✅ PASS | declined offer History placement |
| TRD-TC-B02 | Offer expires (seller never responds) + seller ignore prompt |  | PARTIAL | 2026-08-28 | `qa-trd-b01-b02-reverify-2026-08-28` | 🟡 PARTIAL | expiry mechanics + History PASS; residual F1 'offer_expired' vs 'Offer expired' string mismatch (reverify-a02-b02-b06 flagged FAIL) |
| TRD-TC-B03 | Multiple competing offers — sort order + auto-decline |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | competing offers auto-decline + SP restore (was SKIPPED) |
| TRD-TC-B04 | Buyer cancels pending trade — no consequence level |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | buyer cancels pending, no consequence |
| TRD-TC-B05 | Per-seller cap: max 3 pending offers per seller (2026-07-18) |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | 3 allowed, 4th blocked (copy deviation) |
| TRD-TC-B05a | Per-seller cap: Buyer at 3 with Seller A can still submit to Seller B |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS |  |
| TRD-TC-B05b | Per-seller cap: Blocked at 4th offer to same seller |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | copy deviation 'many pending' vs guide '3 pending' |
| TRD-TC-B05c | Per-seller cap: Bundle offer counts as 1 slot, not N |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | bundle counts as 1 slot |
| TRD-TC-B05d | Per-seller cap: Expired offer frees slot immediately |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | expiry frees slot |
| TRD-TC-B05e | Regression: No leftover global cap blocks buyer over old global limit |  | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | ✅ PASS | no leftover global cap (was BLOCKED) |
| TRD-TC-B05f | Admin config: Change offer cap from 3 to 5 on Trade Timing page |  | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | ✅ PASS | admin cap 3→5 client picks up (was SKIPPED) |
| TRD-TC-B05g | Admin config: Revert cap from 5 back to 3 (forward-looking only) |  | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | ✅ PASS | revert 5→3 forward-looking (was SKIPPED) |
| TRD-TC-B05h | Admin config: Validation — reject invalid values (0, 11) |  | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | ✅ PASS | admin validation (was SKIPPED) |
| TRD-TC-B05i | Mobile client: Config fetch failure — graceful degradation |  | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | ✅ PASS | config-fetch failure graceful (was BLOCKED) |
| TRD-TC-B05j | Regression: Per-seller scope + bundle=1 still hold after config change |  | PASS | 2026-08-28 | `qa-trd-b05e-j-admin-deps-2026-08-28` | ✅ PASS | per-seller scope + bundle=1 after cap change (was BLOCKED) |
| TRD-TC-B06 | Card declined at offer submission |  | PASS | 2026-08-28 | `qa-trd-reverify-a02-b02-b06-2026-08-28` | ✅ PASS | card-decline toggle; friendly error, no trade (was BLOCKED) |
| TRD-TC-B07 | Expired offer timeline — no message button |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | expired timeline no Message/Report/Cancel |
| TRD-TC-B08 | Chat frozen after trade is cancelled or completed |  | PASS | 2026-08-28 | `qa-trd-group-a-b-2026-08-28` | ✅ PASS | chat frozen after cancel |
| TRD-TC-B09 | Chat remains active for in_progress trades |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | chat active for in_progress; real verdict backing guide stamp |
| TRD-TC-B10 | Replace Card path (saved card → new card) |  | PARTIAL | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | 🟡 PARTIAL | attach/persist code-path verified (same path as DT83 D2 PASS); literal new-card entry native-sheet tooling-limited |
| TRD-TC-B11 | Subscribe-upsell → JoinKidsClub |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | subscribe-upsell → JoinKidsClub |
| TRD-TC-B12 | SP info tooltip (not wired — flag) |  | NEVER RUN |  |  | NEVER RUN | SP info tooltip — guide flags not wired |
| TRD-TC-B13 | Duplicate-offer modal navigation (dead code — flag) |  | NEVER RUN |  |  | NEVER RUN | Duplicate-offer modal navigation — guide flags dead code |
| TRD-TC-C01 | SP reserved on offer submission |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | SP reserved on offer |
| TRD-TC-C02 | SP restored to buyer on seller decline |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | SP restored on seller decline |
| TRD-TC-C03 | SP restored to buyer on offer expiry |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | SP restored on expiry |
| TRD-TC-C04 | SP stays reserved when seller accepts |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | SP stays reserved on accept |
| TRD-TC-C05 | SP released to seller at trade completion |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | SP released at completion |
| TRD-TC-C06 | SP restored to buyer on seller cancel (in_progress) |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | SP restored on seller cancel |
| TRD-TC-C07 | Free user sees locked Use SP button + upgrade modal |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | free user locked Use SP + upgrade modal (PASS* deviation) |
| TRD-TC-C08 | SP entry capped by the item's category cap (50–80%, admin-configurable) |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | category-driven % cap clamp (PASS* deviation) |
| TRD-TC-D01 | Auto-complete when buyer never taps I Got It |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | auto-complete fires (PASS* deviation) |
| TRD-TC-D02 | Auto-complete skipped when dispute is open |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | auto-complete skipped when dispute open |
| TRD-TC-D03 | Offer countdown pill color states |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | countdown pill colors (PASS* deviation) |
| TRD-TC-D04 | Auto-complete banner visible to buyer only |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | auto-complete banner buyer-only (PASS* deviation) |
| TRD-TC-D05 | Post-meetup nudge after auto-complete |  | NEVER RUN |  |  | NEVER RUN | Post-meetup nudge after auto-complete — guide: post-MVP, not built |
| TRD-TC-E01 | Buyer opens Report a Problem modal |  | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | ✅ PASS | occlusion fixed; full submit→amber banner (was BLOCKED 08-28) |
| TRD-TC-E02 | Disputed trade does not auto-complete |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | disputed trade no auto-complete |
| TRD-TC-E03 | Buyer UI during active dispute |  | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | ✅ PASS | buyer dispute UI re-confirmed |
| TRD-TC-E04 | Seller UI during active dispute |  | PASS | 2026-08-28 | `qa-trd-b-c-d-e-2026-08-28` | ✅ PASS | seller dispute UI |
| TRD-TC-E05 | Admin resolves dispute → Complete |  | NEVER RUN |  |  | NEVER RUN | Admin resolves dispute → Complete — not run under E-ID; same behavior PASS under TRD-TC-R10 (2026-09-02 qa-task18) |
| TRD-TC-E06 | Admin resolves dispute → Refund |  | NEVER RUN |  |  | NEVER RUN | Admin resolves dispute → Refund — not run under E-ID; same behavior PASS under TRD-TC-R09/R11 (qa-task12/18) |
| TRD-TC-E07 | Report an Issue modal — no reason (disabled submit) |  | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | ✅ PASS | IssueReportModal no-reason disabled submit (was BLOCKED) |
| TRD-TC-E08 | Report an Issue modal — reason selected (non-Other) |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | reason-chip deselect toggle DT-53 (08-29 PARTIAL → PASS) |
| TRD-TC-E09 | Report an Issue modal — "Other" + min-20 description |  | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | ✅ PASS | Other + min-20 description |
| TRD-TC-E10 | Report an Issue modal — submitting + success/error |  | PASS | 2026-08-29 | `qa-task6-e-reverify-2026-08-29` | ✅ PASS | submit → amber banner; DT-42B |
| TRD-TC-F01 | Payout shown on completion (no dispute) |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | payout shown on completion |
| TRD-TC-F02 | Payout held when dispute is open |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | payout held on dispute; admin resolve-complete zeroing P1 fixed (task5 08-29 finding) |
| TRD-TC-F03 | Payout needs action when seller has no payout method |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | no payout method → requires_action |
| TRD-TC-G01 | Offer expiry reminders to seller |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | 6h+1h reminders, dedup |
| TRD-TC-G02 | Auto-complete reminders to buyer |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | 24h+2h auto-complete reminders |
| TRD-TC-G03 | Notification throttle per trade |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | throttle; payout not throttled |
| TRD-TC-G04 | Push notifications deep-link to correct screen |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | offer-reminder deep-link → Review Offer (08-29 PARTIAL gap fixed) |
| TRD-TC-G05 | Buyer cancel-request notification to seller | 2 | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | cancel-request notif to seller |
| TRD-TC-G06 | Cancel-request outcome notifications to buyer |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | cancel-request outcome notif to buyer |
| TRD-TC-G07 | Cancel-request resolution (keep-trade) notifications |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | keep-trade resolution notifs |
| TRD-TC-H01 | Free buyer sees subscription CTA |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | free-buyer upsell copy (qa-trade-success); task16 08-31 PASS* copy-variance |
| TRD-TC-H02 | Subscriber buyer used SP — "You saved $X" |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | 'Got it! You saved $8' permutation |
| TRD-TC-H03 | Subscriber seller on Accept SP listing — SP pending notice |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | seller Accept SP pending-SP notice |
| TRD-TC-H04 | Subscriber seller on Cash Only listing — upsell |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | cash-only upsell to Accept SP (task5 source+unit 08-29) |
| TRD-TC-H05 | Subscription lifecycle — trial / paid / cancel regression |  | PARTIAL | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | 🟡 PARTIAL | trial-start leg not on-device reachable (trial_enabled=false); state machine source-verified |
| TRD-TC-I01 | Safe meetup card on in_progress trade |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | safe-meetup card |
| TRD-TC-I02 | Safe meetup card dismissible per trade |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | dismiss persists per trade |
| TRD-TC-I03 | In-chat safety banner persistent |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | pinned banner |
| TRD-TC-I04 | Pre-first-message safety modal once per listing |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | once-per-trade modal |
| TRD-TC-I05 | Chat quick-reply chips on in_progress trade |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | quick-reply chips send (08-29 FAIL bug fixed DT-48) |
| TRD-TC-I06 | Liability disclaimer modal gates purchase (checkbox + Accept & Continue) |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | disclaimer gates purchase + ack recorded (task5 finding resolved) |
| TRD-TC-I07 | Disclaimer modal Cancel path — no trade created |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | cancel → no trade |
| TRD-TC-I08 | Disclaimer modal ✕ close behaves like Cancel |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | ✕ close like cancel |
| TRD-TC-I09 | Disclaimer checkbox resets to unchecked on reopen |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | checkbox resets on reopen |
| TRD-TC-I10 | Disclaimer modal loading state |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | disclaimer loading/retry |
| TRD-TC-I11 | Disclaimer modal not shown for non-trade actions |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | SP wallet opens, no modal |
| TRD-TC-J01 | Seller cancels in_progress trade → Level 1 |  | DOC-DRIFT | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | 📄 DOC-DRIFT | guide-drift: Level-1 seller-cancel alert removed per TFV2-023; backend count 0→1 verified |
| TRD-TC-J02 | 2nd post-acceptance cancel → Level 2 |  | DOC-DRIFT | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | 📄 DOC-DRIFT | guide-drift: Level-2 alert removed; backend count 1→2 verified |
| TRD-TC-J03 | 3rd post-acceptance cancel → Level 3 |  | DOC-DRIFT | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | 📄 DOC-DRIFT | guide-drift: Level-3 alert removed; backend 2→3 + admin flag verified |
| TRD-TC-J04 | Seller cancel button only on in_progress |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | cancel button only seller, in_progress |
| TRD-TC-J05 | Seller cancel modal shows seller reasons only |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | seller-only reasons (copy deviation) |
| TRD-TC-K01 | Subscriber sees $1.49 fee + Sales Tax line in value stack |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | subscriber stack |
| TRD-TC-K02 | Non-subscriber sees tiered fee (first-trade $1.49) + Sales Tax line in value stack |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | non-subscriber stack + gating |
| TRD-TC-K03 | SP discount row conditional on SP used |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | SP discount row show/hide |
| TRD-TC-K04 | Bundle checkout — fee charged per item (admin toggle OFF) |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | fee toggle OFF ×3 items |
| TRD-TC-K05 | Bundle checkout — one fee per bundle (admin toggle ON) |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | fee toggle ON 1× |
| TRD-TC-K06 | Bundle timeline — fee display matches charge mode |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | both bundle modes |
| TRD-TC-K07 | Admin partial refund — refund price only, keep fee |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | partial refund price-only |
| TRD-TC-K08 | Admin partial refund — tax ledger partially refunded |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | tax ledger on partial refund (task5 finding fixed DT-48) |
| TRD-TC-K09 | Payments reconciliation page — charged vs refunded per trade |  | PASS | 2026-08-29 | `qa-task5-trd-f-k-2026-08-29` | ✅ PASS | payments reconciliation |
| TRD-TC-K10 | Server-side enforcement — one-fee-per-bundle with stale client |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | EF stale-client bundle → 409 SP_INSUFFICIENT (task5 TRADE_INSERT_ERROR fixed) |
| TRD-TC-K11 | Seller fee = 5% × cash portion (SP trade) |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | fee = pct × cash portion (staging 10/20%, guide 5% stale) |
| TRD-TC-L01 | Bundle banner on trade detail |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | bundle banner expand |
| TRD-TC-L02 | Confirm All shortcut for bundle (buyer) |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | Confirm All 2 |
| TRD-TC-L03 | Bundle offer rows in Offers tab (seller) |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | NEEDS ACTION bundle row |
| TRD-TC-L04 | Non-bundle offers render as single rows |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | single row Review only |
| TRD-TC-L05 | In-progress bundles section in Buying tab |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | IN PROGRESS bundle group |
| TRD-TC-L06 | Bundle banner in Review Offer screen |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | Review Offer bundle SP/net |
| TRD-TC-L07 | Accept All N Items in Review Offer screen |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | Accept All |
| TRD-TC-L08 | Individual accept/decline alongside bundle siblings |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | individual accept + sibling pending |
| TRD-TC-L09 | Bundle card in Your Offers (buyer) |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | Your Offers bundle card; disclaimer=Amazon boilerplate finding |
| TRD-TC-L10 | Bundle cancel prompt (buyer + seller) |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | cancel-all vs just-this-one |
| TRD-TC-L11 | Bundle checkout skips items already in an active trade — buyer notified, flow continues |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | bundle checkout active-trade item |
| TRD-TC-M01 | Add first item → active cart created |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | add first item |
| TRD-TC-M02 | Add second item from same seller |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | same-seller direct add |
| TRD-TC-M03 | Add item from different seller → choice modal |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | different-seller modal |
| TRD-TC-M04 | Replace Cart option |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | replace cart |
| TRD-TC-M05 | Cannot add own item to cart |  | SKIPPED | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ⏭️ SKIPPED | own-item add — not exercised (second-persona need) |
| TRD-TC-M06 | Cannot add unavailable / out-of-node item |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | sold item not found |
| TRD-TC-M07 | Duplicate item prevented in same cart |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | duplicate add in-cart |
| TRD-TC-M08 | Remove item from cart |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | remove item |
| TRD-TC-M09 | Clear cart |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | clear cart $0 |
| TRD-TC-M10 | Saved carts: max 3, server rejects 4th save, switch cart |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | saved-cart 3/3 cap server reject; doc drift LRU |
| TRD-TC-M11 | Minimum cart value warning + checkout blocked |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | min cart value (via N01) |
| TRD-TC-M12 | Max SP available shown per cart item (subscriber) |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | Accepts Points badge; no numeric |
| TRD-TC-M13 | Realtime: item becomes unavailable while in cart |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | realtime-unavailable notice |
| TRD-TC-M14 | Favorites add / remove |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | favorite add/remove |
| TRD-TC-M15 | Favorites screen: availability + empty state |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | unavailable overlay |
| TRD-TC-M16 | Success toast appears and auto-dismisses on add-to-cart |  | PARTIAL | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | 🟡 PARTIAL | toast 2.5s window; source-corroborated |
| TRD-TC-M17 | Cart badge increments in sync with toast |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | cart badge |
| TRD-TC-M18 | Toast copy uses "Trade Basket" terminology |  | PARTIAL | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | 🟡 PARTIAL | toast; source-corroborated |
| TRD-TC-M19 | Home dashboard Favorites quick-action tile navigates to Favorites |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | home tile favorites |
| TRD-TC-M20 | Discover header heart icon navigates to Favorites |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | discover header favorites |
| TRD-TC-N01 | Admin sets minimum cart value → reflects in app |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | admin min cart value reflects in app + blocked checkout |
| TRD-TC-N02 | Admin minimum cart value validation |  | PASS | 2026-08-30 | `qa-task7-expanded-lmn-retest-2026-08-30` | ✅ PASS | admin validation; no $5 floor (doc drift) |
| TRD-TC-N03 | Admin updates Minimum Listing Price on Config → Fees tab |  | PARTIAL | 2026-08-30 | `qa-task10-dt66-fix-verify-tr-d-2026-08-30` | 🟡 PARTIAL | min listing price config-write leg 0→5→0 verified |
| TRD-TC-N04 | Seller cannot publish single-item listing below threshold |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | below-threshold adjust-price modal |
| TRD-TC-N05 | Bulk: below-threshold items flagged, valid items publish |  | PASS | 2026-08-31 | `qa-task13-dt71-dt72-verify-2026-08-31` | ✅ PASS | bulk below-min block closed (DT71/DT69); was BLOCKED/PARTIAL |
| TRD-TC-N06 | Existing listing auto-paused when threshold raised above price |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | admin auto-pause real |
| TRD-TC-N07 | Seller raises price to meet threshold → listing repurchasable |  | BLOCKED | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | 🔴 STILL OPEN | FLAG: needs auto-paused sub-min $4 listing fixture (R41); positive leg not driven |
| TRD-TC-N08 | Regression: single-item + bundle checkout at/above threshold |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | single + bundle at/above threshold |
| TRD-TC-N09 | Price adjustment modal displays correct copy and button text (single-item) |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | modal copy/button |
| TRD-TC-N10 | "Update Price" dismisses modal and auto-scrolls + auto-focuses price field (single-item) |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | dismiss + autoscroll/focus |
| TRD-TC-N11 | Price adjustment modal in edit listing flow (single-item edit) |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | edit-flow modal, no save |
| TRD-TC-N12 | Bulk listing: per-item chip shows dynamic threshold in missing-required warning |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | bulk chip dynamic threshold |
| TRD-TC-N13 | Bulk listing: publish failure shows clear error message for below-threshold items |  | PASS | 2026-08-31 | `qa-task13-dt71-dt72-verify-2026-08-31` | ✅ PASS | bulk publish error (was BLOCKED) |
| TRD-TC-N14 | Regression: minimum-price validation still blocks publish in single-item and bulk flows |  | PASS | 2026-08-31 | `qa-task13-dt71-dt72-verify-2026-08-31` | ✅ PASS | regression blocks (was PARTIAL) |
| TRD-TC-O01 | Sales tax shown in checkout/cart breakdown (0 SP) |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | tax in checkout $2.10 on $30 |
| TRD-TC-O02 | Tax base stays on full item price as SP entry changes (offer + checkout) |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | SP=4 tax unchanged (BP-37) |
| TRD-TC-O03 | Tax $0 when globally disabled |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | global toggle honored read+write (task11 FAIL fixed DT68) |
| TRD-TC-O04 | Tax $0 when node tax disabled |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | rule engine overrides node rate (re-verified DT69) |
| TRD-TC-O05 | Tax-exempt user sees Tax Free badge |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | Tax Free badge |
| TRD-TC-O06 | Transaction history shows tax details |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | completed Payment Details rows |
| TRD-TC-O07 | Refund shows proportional tax refunded |  | PARTIAL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | 🟡 PARTIAL | backend proportional tax refund DB-verified; end-user refund-detail UI deferred (guide ⏭️) |
| TRD-TC-O08 | Tax shown on trade timeline/detail for buyer only |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | Estimated Sales Tax buyer-only |
| TRD-TC-O1 | Admin creates a new tax rule for general_tangible_goods |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | /tax/rules admin surface confirmed (O1-C1..C17) |
| TRD-TC-O2 | Single taxable item, no SP — offer is quoted/authorized, not collected |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | quote/authorize-not-collect mobile leg |
| TRD-TC-O3 | Buyer wording: "Payment authorized" before capture (Awaiting Seller) |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | 'Payment authorized' while awaiting seller |
| TRD-TC-P01 | Node tax rate config (view/edit, validation) |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | node rate save + validation real |
| TRD-TC-P02 | Bulk tax update across nodes |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | no bulk-node UI exists; matches guide defer |
| TRD-TC-P03 | Tax rate change history / audit |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | rules version history; no node change-history UI |
| TRD-TC-P04 | Global tax settings toggle + warning banner |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | toggle round-trips (task11 FAIL fixed) |
| TRD-TC-P05 | Tax reporting dashboard: summary + date presets |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | tax reports summary |
| TRD-TC-P06 | Jurisdiction breakdown + 7 report types |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | by-jurisdiction breakdown |
| TRD-TC-P07 | CSV export for filing |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | export CSV wired; download env-limited |
| TRD-TC-P08 | Admin changes rate → new transactions use new rate |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | new txn uses rule rate (re-verified) |
| TRD-TC-Q01 | Review prompt ([Rate Seller] / [Rate Buyer]) on completion |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | rate prompt |
| TRD-TC-Q02 | Star rating required — submit blocked without rating |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | rating required |
| TRD-TC-Q03 | Comment optional, max 500 characters |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | char count |
| TRD-TC-Q04 | Anonymous review hides reviewer identity |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | anonymous |
| TRD-TC-Q05 | Skip review — no blocking, no re-prompt for same trade |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | Skip for Now (analytics-only) |
| TRD-TC-Q06 | Mutual review status shown on completed trade detail |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | reviewed-banner |
| TRD-TC-Q07 | Completed reviews visible on counterparty's profile |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | profile visible |
| TRD-TC-Q08 | Average rating and total review count on user profile |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | average |
| TRD-TC-Q09 | Rating breakdown (5 → 1 stars) on profile |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | breakdown |
| TRD-TC-Q10 | Edit review succeeds within 24h window |  | NEVER RUN |  |  | NEVER RUN | 24h edit window — time-dependent, descoped |
| TRD-TC-Q11 | Edit blocked after 24h window |  | NEVER RUN |  |  | NEVER RUN | 24h edit window — time-dependent, descoped |
| TRD-TC-Q12 | One review per trade — duplicate submission blocked |  | PASS | 2026-08-30 | `qa-task11-nopqr-2026-08-30` | ✅ PASS | no duplicate prompt |
| TRD-TC-Q13 | 30-day same-counterparty cooldown enforced |  | NEVER RUN |  |  | NEVER RUN | 30-day cooldown — time/multi-account, descoped |
| TRD-TC-Q14 | 24h post-completion cooldown — review locked |  | NEVER RUN |  |  | NEVER RUN | 24h post-completion lock — time-dependent, descoped |
| TRD-TC-Q15 | Flag a review (select reason) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | reviewee-only report model PASS; spec deviation (guide: any user) |
| TRD-TC-Q16 | Auto-hide review after 3+ reports |  | NEVER RUN |  |  | NEVER RUN | Auto-hide after 3+ reports — needs 3 distinct reporters, descoped |
| TRD-TC-Q17 | Cannot flag own review |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | cannot flag own review (model) |
| TRD-TC-Q18 | Admin moderation queue — reported reviews with counts |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | moderation queue |
| TRD-TC-Q19 | Admin approves (unhides) a reported review |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | Keep |
| TRD-TC-Q20 | Admin deletes a reported review |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | Hide |
| TRD-TC-R01 | Buyer cancels pending trade → cancelled, auth voided, SP restored |  | NEVER RUN |  |  | NEVER RUN | Buyer cancels pending — equivalent behavior PASS under TRD-TC-B04 |
| TRD-TC-R02 | Seller declines pending offer → cancelled, SP restored |  | NEVER RUN |  |  | NEVER RUN | Seller declines pending — equivalent PASS under TRD-TC-B01/C02 |
| TRD-TC-R03 | Offer expiry → auto-cancel + competing offers cancelled |  | NEVER RUN |  |  | NEVER RUN | Offer expiry auto-cancel — equivalent PASS under TRD-TC-B02/C03 |
| TRD-TC-R04 | Card declined at offer submission → no trade created |  | NEVER RUN |  |  | NEVER RUN | Card declined at offer — equivalent PASS under TRD-TC-B06 |
| TRD-TC-R05 | Seller cancels in_progress → refund + consequence level |  | NEVER RUN |  |  | NEVER RUN | Seller cancels in_progress — equivalent PASS under TRD-TC-C06 |
| TRD-TC-R06 | Refund settlement breakdown (cash + proportional tax + fee) |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS | void correct for uncaptured auth (DT68) |
| TRD-TC-T01 | SP input appears only on eligible items; ineligible show "Not eligible" label |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | SP input on Accept-SP item only |
| TRD-TC-T02 | Entered SP applies correct amount (wallet + category cap both sufficient) |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | 45 SP applied to $60 (75% cap) |
| TRD-TC-T03 | Entered SP applies partial amount with "Limited by your SP balance" subtext when wallet insufficient |  | PARTIAL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | 🟡 PARTIAL | wallet-limited path w/ actual balance 4; guide 8-SP scenario not reproducible; DT72 phrasing verified |
| TRD-TC-T04 | Category cap limits applied points even when wallet covers more |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | admin-set cap → client hint + server reject (task15 divergence fixed) |
| TRD-TC-T05 | Clearing SP restores balance for sequential allocation |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | sequential allocation real-time |
| TRD-TC-T06 | Running "Points remaining" counter updates accurately across entries/clears |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | real-time counter on 3-item bundle (task12/task13/15) |
| TRD-TC-T07 | Order Summary "Points Applied" line and cash total correct after multiple SP entries |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | order-summary math |
| TRD-TC-T08 | Seller Review Offer shows per-item points breakdown |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | bundle-list vs payout-card SP off-by-one fixed (DT76) |
| TRD-TC-T09 | Seller Review Offer shows "Total Payout" and "Buyer's Total Paid" correctly |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | payout card + bundle totals |
| TRD-TC-T10 | "Includes points redemption" tag on seller's offer list/inbox card |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | 'Includes points redemption' tag on bundle (task15 finding fixed) |
| TRD-TC-T11 | Wallet ledger: buyer debited at offer, seller credited + bonus at completion |  | PARTIAL | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | 🟡 PARTIAL | SP transfers at COMPLETION by design (D-17); completion-time release verified across A02/C05/Z05 runs |
| TRD-TC-T12 | No ledger transaction on offer decline |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | seller decline no seller ledger; buyer refund |
| TRD-TC-T13 | Regression: single-item (non-bundle) offer flow with SP still works |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | single-item SP regression |
| TRD-TC-T14 | Regression: bundle CTA, different-seller modal, "more from this seller" still functional |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | bundle CTA / modal / more-from-seller regression |
| TRD-TC-R07 | SP reversal on refund (reserved/transferred returned) |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | source-confirmed SP reversal mechanism; SP in-progress cancel not UI-driven |
| TRD-TC-R08 | Seller payout withheld / cancelled on refund |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | no seller_payouts on cancel/void (re-confirmed) |
| TRD-TC-R09 | Admin dispute resolve → Refund (full settlement) |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | dispute queue verified; resolve→Refund money-flow fixture-gapped |
| TRD-TC-R10 | Admin dispute resolve → Complete (no refund) |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | admin dispute → Complete; payout row; PI-capture timing observation |
| TRD-TC-R11 | Refund / cancellation notifications to both parties |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | refund/cancel notifs both parties |
| TRD-TC-R12 | Refund idempotency — no double refund |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | refund idempotency |
| TRD-TC-R13 | Cancelled / refunded trade status + timeline |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | cancelled status + timeline |
| TRD-TC-S01 | Different-seller modal uses generic copy (no seller name leak) |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S02 | "More from this seller" icon appears only when 2+ approved listings |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S03 | "More from this seller" icon hidden when seller has exactly 1 listing |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | hide gate source-confirmed; no single-listing-seller fixture |
| TRD-TC-S04 | Tapping icon opens "More from this seller" page — no seller identity |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S05 | Add to Cart from filtered seller page populates cart correctly |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S06 | "Matches Your Cart" indicator on filtered seller page |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | matchesBanner source-verified |
| TRD-TC-S07 | Bundle CTA appears on CartScreen with 2+ same-seller items |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S08 | Bundle CTA hidden with single item or empty cart |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | 1-item CTA source-confirmed |
| TRD-TC-S09 | Bundle CTA navigates to checkout in bundle mode |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S10 | Bundle checkout shows "Bundle Offer" banner |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | bundle banner bundleMode source |
| TRD-TC-S11 | Regression: Discover/search grid unchanged (no badges) |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | discover grid unchanged source |
| TRD-TC-S12 | Regression: single-item offer flow unchanged |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | single-offer flow unchanged source |
| TRD-TC-S13 | Regression: seller identity unlocks only post-acceptance |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S14 | More from seller — Item Detail CTA in standalone position (below seller card) |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S15 | More from seller — Item Detail CTA hidden at 0 additional listings |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | same hide gate as S03 |
| TRD-TC-S16 | More from seller — Item Detail CTA does not disrupt "Matches Your Cart" badge |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | banner doesn't disrupt badge source |
| TRD-TC-S17 | More from seller — Trade Basket banner shows correct remaining-item count |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S18 | More from seller — Trade Basket banner recalculates after adding item from filtered page |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | count recalc source |
| TRD-TC-S19 | More from seller — Trade Basket banner disappears when all seller's listings are in basket |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | hidden when all in basket source |
| TRD-TC-S20 | More from seller — Trade Basket banner dismissible via X button |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S21 | More from seller — Banner and filtered page never reveal seller identity |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S22 | Regression: Seller Info card elements unchanged |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | seller card unchanged source |
| TRD-TC-S23 | Regression: Trade Basket subtotal/total/bundle CTA layout unaffected |  | PASS | 2026-08-30 | `qa-task12-close-2026-08-30` | ✅ PASS |  |
| TRD-TC-S24 | More from seller — Return-to-Cart navigation after adding item from filtered page |  | PARTIAL | 2026-08-30 | `qa-task12-close-2026-08-30` | 🟡 PARTIAL | return-to-cart nav source |
| TRD-TC-X01 | Bottom nav renders identically on Home (Dashboard) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | tab label 'Basket' — see V01 |
| TRD-TC-X02 | Bottom nav renders identically on Discover |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X03 | Bottom nav renders identically on Trades |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X04 | Bottom nav renders identically on Trade Basket |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X05 | Bottom nav renders on Item Detail / Cart Checkout / Trade screens |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X06 | Bottom nav renders on Profile, Settings, Wallet, Subscriptions |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X07 | Cart badge shows item count from multiple entry points |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X08 | Cart badge count accuracy — add / remove / clear |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X09 | "Me" tab removed — Profile still accessible via Home avatar |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X10 | Sell FAB opens action sheet on every screen |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS |  |
| TRD-TC-X16 | Flow Registry (nav) — flow-registry.md entries updated |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | flow-registry entries source |
| TRD-TC-U01 | Root/tab screens use pattern 1 (no back button, greeting/avatar/title, bell) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | root header pattern |
| TRD-TC-U02 | Secondary/detail screens use pattern 2 (back button + title + bell) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | detail back-button |
| TRD-TC-U03 | Notification bell behavior + badge accuracy |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | bell → notifications |
| TRD-TC-U04 | Screens without ScreenLayout still have working headers |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | EditProfile canonical header |
| TRD-TC-U05 | Checkout/payment screens intentionally hide the bell |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | checkout header hides bell |
| TRD-TC-V01 | "Basket" (short form) appears in bottom tab bar |  | FAIL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | 🔴 STILL OPEN | bottom-tab label 'Basket' not 'Trade Basket' (real copy defect; X01 same) |
| TRD-TC-V02 | "Trade Basket" appears as screen title on Cart screen |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | cart title |
| TRD-TC-V03 | Empty state shows "trade basket" in copy |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | empty state |
| TRD-TC-V04 | "View Trade Basket" button on Item Detail screen |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | Item Detail button |
| TRD-TC-V05 | "Add to Trade Basket" button on More from This Seller screen |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | more-from-seller add |
| TRD-TC-V06 | "In Trade Basket" status on More from This Seller items already in basket |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | in-basket dimmed |
| TRD-TC-V07 | "Added to Trade Basket" alert on item add |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | added alert |
| TRD-TC-V08 | "Matches Your Trade Basket" badge on matching items |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | badge immediate on Item Detail (task14 FAIL fixed DT75) |
| TRD-TC-V09 | Different-seller modal references "trade basket" |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | different-seller modal copy |
| TRD-TC-V10 | Bundle CTA says "Make one offer" (no "Bundle" visible) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | bundle CTA wording |
| TRD-TC-V11 | "Combined Offer" banner on checkout (no "Bundle" visible) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | checkout combined banner |
| TRD-TC-V12 | Bundle Builder screen title shows "Build Offer" (no "Bundle" visible) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | Build Offer title |
| TRD-TC-V13 | Favorites "Added to Trade Basket" alert copy |  | PARTIAL | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | 🟡 PARTIAL | alert copy verified; favorites-screen trigger not driven |
| TRD-TC-V14 | Functional behavior unchanged (adding items, submitting offers) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | functional regression |
| TRD-TC-W01 | Trades page has "Single Trades" and "Bundle Trades" tabs |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | tabs |
| TRD-TC-W02 | Single Trades tab shows only non-bundle trades |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | single table |
| TRD-TC-W03 | Bundle Trades tab groups trades by bundle_id |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | bundle columns |
| TRD-TC-W04 | Bundle row shows item count, totals, buyer/seller, statuses |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | bundle row |
| TRD-TC-W05 | Clicking a bundle row navigates to bundle detail page |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | bundle detail |
| TRD-TC-W06 | Bundle detail page lists all trades in the bundle |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | trades in bundle |
| TRD-TC-W07 | Bundle detail page shows monetary breakdown |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | monetary breakdown |
| TRD-TC-W08 | Each trade row links to individual trade detail |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | single detail |
| TRD-TC-W09 | Bundle detail page has "Force Cancel Entire Bundle" action |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | Force Cancel visible on non-terminal fixture (task15 negative-only) |
| TRD-TC-W10 | Force Cancel succeeds for all trades in the bundle |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | Force Cancel succeeds + DB read-back |
| TRD-TC-W11 | Status filter works in Bundle Trades view |  | PASS | 2026-08-31 | `qa-task15-dt75-w-t-2026-08-31` | ✅ PASS | status filter |
| TRD-TC-W12 | Tab toggle resets filters when switching views |  | PASS | 2026-08-31 | `qa-task16-close-trd-2026-08-31` | ✅ PASS | status filter resets on Single↔Bundle toggle (task15 minor defect fixed) |
| TRD-TC-D06 | Pickup window drives the auto-complete deadline (R2 — configurable) |  | NEVER RUN |  |  | NEVER RUN | (post-MVP / not built) |
| TRD-TC-N2 | Retried offer submission → exactly 1 PaymentIntent / 1 trade / 1 SP reservation / 1 audit row |  | NEVER RUN |  |  | NEVER RUN | Idempotency & Audit (N2-C01..C10) — no dedicated run; individual idempotency legs verified under B/C/O/R rows |
| TRD-TC-Y01 | Trade List summary filter chips |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | summary chips |
| TRD-TC-Y02 | Trade List Load More history pagination |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | history pagination |
| TRD-TC-Y03 | Trade List Message button on rows |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | row Message |
| TRD-TC-Y04 | Trade List "See all →" link |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | See all → History |
| TRD-TC-Y05 | R15 — Request More Time (requester) |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | request extension |
| TRD-TC-Y06 | R15 — counterparty Accept |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | counterparty accept |
| TRD-TC-Y07 | R15 — counterparty Decline |  | SKIPPED | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ⏭️ SKIPPED | decline path not driven (single-extension-per-trade) |
| TRD-TC-Y08 | R15 — granted state |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | granted state |
| TRD-TC-Y09 | "What to do next" card + "Got it" toggle |  | PASS | 2026-08-31 | `qa-task14-dt73-u-y-2026-08-31` | ✅ PASS | what-to-do card |
| TRD-TC-Z01 | Buyer request → seller approves → cancel + refund |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | approve → cancel + refund |
| TRD-TC-Z02 | Seller declines → escalate → admin approve-cancel |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | decline → escalate → admin approves |
| TRD-TC-Z03 | Timeout auto-escalates to admin |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | timeout escalation → buyer notified (task17 no-notify defect fixed) |
| TRD-TC-Z04 | Buyer withdraws a pending request |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | buyer withdraw |
| TRD-TC-Z05 | Bundle: whole-bundle default + per-item option |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | whole-bundle cancel cascade + sibling SP release (task17 HIGH defect closed) |
| TRD-TC-Z06 | Escalation disabled → decline ends the request |  | PASS | 2026-09-02 | `qa-task18-close-trd-2026-09-02` | ✅ PASS | escalation-off copy (task17 copy defect fixed) |
| TRD-TC-Z07 | Gating: no request on pending/completed/disputed/duplicate |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | gating by state |
| TRD-TC-Z08 | Regression: seller instant cancel unchanged |  | PASS | 2026-09-01 | `qa-task17-z-g-dt78-81-2026-09-01` | ✅ PASS | seller instant cancel + TFV2-023 consequence |

### ACC (Account/Dashboard/Help/Legal) — 75 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|
| ACC-TC-A01 | Settings screen sections + rows render |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-A02 | Sign Out confirmation |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-A03 | Test Push Notification (rate limit / quiet hours / queued) |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-A04 | Settings → legal & help links navigate |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-A05 | "Manage Payment Methods" row navigates |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-B01 | Edit profile fields load + save (optimistic) |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-B02 | Email change requires re-verification |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-B03 | Phone change → OTP verification modal |  | BLOCKED | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-B04 | Avatar upload |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-B05 | Profile screen stats, badges, reviews, status badge |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-B06 | Form validation (phone 10-digit, email format) |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-B07 | "No Changes" alert |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-B08 | Waitlist prompt (unreachable from Edit Profile — flag) |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-B09 | "Already verified" phone path |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-B10 | Locked-field "cannot be changed" alerts |  | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | ✅ PASS |  |
| ACC-TC-C01 | Linked accounts list (email readonly, password, social) |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-C02 | Link a social provider (password re-auth gate) |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-C03 | Unlink provider (confirmation + last-method guard) |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-C04 | Email mismatch on link blocked |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-D01 | Five categories × three channel toggles |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-D02 | Optimistic toggle reverts on failure |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-D03 | Quiet hours toggle + time validation |  | PASS | 2026-08-24 | `account-file-groups-abcd-2026-08-24` | ✅ PASS |  |
| ACC-TC-D04 | Empty state → Initialize Settings |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-E01 | Delete account consequences + password gate |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-E02 | Wrong password blocked |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-E03 | Two-step confirmation → deletion + logout |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-F01 | Suspended account screen (Contact Support + Log Out, no email) |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-F02 | Unsubscribe via deep-link token (success/error) |  | BLOCKED | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-F03 | Offline screen + Try Again |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-F04 | Suspended account — Log Out tap |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-G01 | Greeting + subscription badge + SP balance |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-G02 | Dashboard banners (independent top banners + Action Items list) |  | BLOCKED | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-G03 | Quick action tiles route correctly |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G04 | ID verification CTA banner (none / rejected only) |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G05 | Recommendations + recent trade card |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G06 | Pull-to-refresh reloads dashboard |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G07 | "Show more actions" toggle |  | PASS | 2026-08-25 | `account-file-groups-a-g-full-closure-2026-08-25` | ✅ PASS |  |
| ACC-TC-G08 | Free-user "Unlock Swap Points" strip |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G09 | "No session found" state |  | BLOCKED | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-G10 | Empty-trade state |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G11 | "View Timeline" nav |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G12 | "See All" → Discover nav |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-G13 | Subscription-card Upgrade button |  | PASS | 2026-08-24 | `account-file-groups-efg-c03-2026-08-24` | ✅ PASS |  |
| ACC-TC-H01 | Help & Support menu (3 cards) routes (entered from Profile) |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-H02 | FAQ list — search + category filter |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-H03 | FAQ fallback when offline |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-H04 | FAQ detail — helpful vote (Yes/No) |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-H05 | Contact Support form (unified flow — logged-in AND logged-out) |  | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | ✅ PASS |  |
| ACC-TC-H06 | No raw support-email surfaces (cross-screen sweep) |  | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | ✅ PASS |  |
| ACC-TC-H07 | Contact Support reachable logged-out (Login + Signup entry) |  | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | ✅ PASS |  |
| ACC-TC-I01 | Education Help screen sections (accordion + deep link) |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-I02 | SP Calculator (free mode) sell/buy outputs |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-I03 | SP Calculator bonus category badge |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-I04 | SP Calculator validation (price range) |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-I05 | Education analytics events fire |  | PASS | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | ✅ PASS |  |
| ACC-TC-J01 | Terms of Service view + last updated |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-J02 | TOS acceptance flow (requireAcceptance) |  | FAIL | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | 🔴 STILL OPEN | FAIL, unresolved |
| ACC-TC-J03 | Privacy Policy view + acceptance |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-J04 | Liability Disclaimer view (read-only + retry) |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-J05 | Policy versioning — re-acceptance on new version |  | FAIL | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | 🔴 STILL OPEN | FAIL, unresolved |
| ACC-TC-J06 | Signup implies TOS + Privacy agreement (no mandatory dialog) |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-J07 | Legal screen unavailable state (no published policy) |  | BLOCKED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-J08 | Legal screen load failure — inline error (Retry only on Liability) |  | BLOCKED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-J09 | Very long policy content renders + scrolls smoothly |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-J10 | Legal screens render consistently on iOS and Android |  | SKIPPED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ⏭️ SKIPPED |  |
| ACC-TC-J11 | Legal screen loads < 2s and scrolls without lag |  | PASS | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | ✅ PASS |  |
| ACC-TC-J12 | Liability Disclaimer unavailable state |  | BLOCKED | 2026-08-26 | `account-file-j-legal-email-stall-2026-08-26` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-K01 | 🚫 NOT IMPLEMENTED — MFA factors list + enrollment (no UI exists) |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-K02 | 🚫 NOT IMPLEMENTED — enroll/verify authenticator factor (no UI) |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-K03 | 🚫 NOT IMPLEMENTED — MFA challenge on protected action (no UI) |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-K04 | 🚫 NOT IMPLEMENTED — recovery / remove factor (no UI) |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-L01 | Render-time error shows fallback instead of red/white screen |  | PASS | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | ✅ PASS |  |
| ACC-TC-L02 | Try Again recovers after transient error |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-L03 | Persistent error stays contained to fallback |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| ACC-TC-L04 | Error reporting is safe with and without telemetry |  | BLOCKED | 2026-08-25 | `account-file-b-h-ikl-2026-08-25` | 🔴 STILL OPEN | BLOCKED (env/fixture) |

### ADM (Admin Portal) — 160 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|
| ADM-TC-A01 | Admin login with admin role |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-A02 | Non-admin login rejected (RBAC gate) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-A03 | Dashboard layout: intro → health strip → Action Center → KPIs (no duplicate nav) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-A04 | Direct protected route access without session redirects to login |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-A05 | Expired session redirects once without a loop |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-A06 | Dashboard KPI cards follow design-system styling |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B01 | User list, search, status filters, pagination |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B02 | User detail drawer (identity, subscription, SP, trades) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B03 | Suspend / ban / delete account |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B04 | Credit/debit SP + freeze wallet from user |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B05 | User analytics cards (totals, DAU/MAU) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B06 | Reset Password action |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B07 | Unsuspend action |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-B08 | Sort By / Sort Order |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C01 | Listing management — search & analytics tabs |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C02 | Flagged items — filter tabs + statuses |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C03 | Approve flagged item |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C04 | Reject item with required reason |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C05 | Item detail view + appeal info |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C06 | Force Delete |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C07 | Pause |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C08 | Approve |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C09 | Request Edits |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C10 | Reject |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C11 | Select-all / selection counter (no bulk execute — flag) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-C12 | Individual filter controls |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D01 | Category list, filters (incl. Bonus), search |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D02 | Create / edit category + SP multiplier |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D03 | Activate / deactivate category |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D04 | Category suggestions queue + count badge |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D05 | Icon / badge upload |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D06 | SP spending cap % |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D07 | SP redemption cap |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D08 | Drag-and-drop reorder |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D09 | Bulk actions (Activate / Deactivate / Delete / Export CSV) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D10 | Delete category + guards |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-D11 | Suggestion Approve / Merge / Reject |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E01 | Geographic nodes list + stats |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E02 | Add / edit node |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E03 | Deactivate node with members warning |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E04 | Node settings (radius validations) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E05 | ZIP waitlist queue + status filter |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E06 | Node tagging completeness (N6) — every record resolves to one node |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E07 | Per-node KPIs (N6) — expansion-gate metrics per node |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-E08 | Waitlist API authorization (401 without admin session) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F01 | Global configuration inline edit + permission gate |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F02 | Cart settings (min value, max carts, expiry) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F03 | Trade timing config (timing keys + nested validation) — incl. consolidated fees |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F04 | Settings single-source — cross-link + last-updated + audit |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F05 | N1 configurability — pickup countdown + payout buffer (live) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F06 | R2 — 7-day guardrail (hard block) + pickup reminders (live) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F07 | Trade Pipeline visualization — see & track trades in all stages |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F08 | R1 tiered buyer-fee fields (live) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F09 | Buyer Fee-Tier Distribution table (moved → /analytics) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F10 | Legacy fee keys (audit-only, read-only — live) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-F11 | Reset button |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-G01 | Policy tabs (TOS/Privacy/Liability) + versions |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-G02 | Create new policy version (version regex) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-G03 | Edit draft policy |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-G04 | Publish policy (confirmation) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-H01 | Trade list filters + columns |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-H02 | Trade detail (info, monetary breakdown, audit) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-H03 | Trade admin actions |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-H04 | Subscription Context section |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-H05 | External References (Stripe PI/refund + SP ledger IDs) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-H06 | Sales Tax line in monetary breakdown |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-I01 | Dispute queue + SLA highlighting |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-I02 | Mark dispute under review |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-I03 | Resolve dispute — Complete |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-I04 | Resolve dispute — Refund |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-I05 | Filter-tab click behavior (All/Reported/Under Review) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-J01 | Tax admin entry points (no bare /tax — use sub-pages) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-K01 | Payout fee configuration + test breakdown |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-K02 | Payouts management list, stats, filters |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-K03 | Retry failed payout (confirmation) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L01 | SP Economy hub tabs (Health/Flow/Rules) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L02 | SP Analytics dashboard + CSV export |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L03 | SP Wallet admin — economy metrics + search |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L04 | SP adjustment (credit/deduct) with reason |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L05 | Freeze / unfreeze / suspend wallet |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L06 | SP Economy summary metrics — dashboard + /sp-wallet entry (no home card) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L07 | SP Wallet state RPC — get_user_sp_wallet_summary returns wallet_state |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-L08 | SP Wallet warning banners (mobile) — frozen/suspended/grace |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-M01 | Grace period config (days + reminders) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-M02 | Subscriptions list, filters, metrics |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-M03 | Extend / cancel / reactivate |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-M04 | Reactivate button (confirm + mobile reflection) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-M05 | Metrics cards (MRR/churn/trial) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-M06 | "free" status filter |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-N01 | Referral configuration tab |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-N02 | Referral analytics tab |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-N03 | 5 SP fields + 3 toggles |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-N04 | "Missing configuration" warning |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-O01 | ID badge queue + stats + status filter |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-O02 | Review request — approve |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-O03 | Review request — reject with reason |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-O04 | Request details (screenshot deleted note) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-O05 | Message templates edit |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-P01 | Badge management list + toggle |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-P02 | Create/edit/delete badge |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-P03 | Manual award badge |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-P04 | Badge sandbox event simulation |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Q01 | Reported reviews list + reason filter |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Q02 | Hide review (confirmation — copy corrected) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Q03 | Approve review (unhide + delete reports — copy corrected) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Q04 | Status filter dropdown |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Q05 | Sort-by dropdown |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Q06 | Search input |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-R01 | Education sections/examples/analytics |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-R02 | FAQ management (questions/categories/analytics) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-R03 | Publish FAQ / education content |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-S01 | Support inbox + unread filter (incl. Guest tickets) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-S02 | Support detail + mark as read |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-S03 | Support reply (stored + emailed to user) |  | SKIPPED | 2026-08-26 | `account-file-full-closure-b02-b03-h05-h06-h07-s03-l01-l04-2026-08-26` | ⏭️ SKIPPED |  |
| ADM-TC-T01 | Revenue & Analytics dashboard |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-T02 | Notification analytics (category/type/variant) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-U01 | Audit logs view |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-V01 | Monitoring run + alerts (acknowledge/note) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-V02 | Cron jobs status + run history + timezone |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W01 | Sidebar grouped into 7 labeled sections |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W02 | Expand / collapse a section via label + chevron |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W03 | Section state persists per admin across sessions |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W04 | Active route auto-expands its parent section |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W05 | Active/inactive item styling + label typography |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W06 | Collapsed icon rail shows all destinations |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-W07 | All previous nav destinations still reachable |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X01 | Action Center page loads aggregated cards |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X02 | Same-type items bundled with count |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X03 | Severity tags (Urgent/Routine) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X04 | Expand card drills into item list |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X05 | Inline approve flagged item |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X06 | Inline mark dispute under review |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X07 | Inline retry failed payout (confirmation) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X08 | Empty state "All caught up" |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X09 | Sidebar pinned nav item + live count badge |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X10 | Header bell opens Action Center + badge |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X11 | Config drift card lists out-of-range settings |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X12 | Dashboard embeds top-5 Action Center cards + View all link |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X13 | Cancellation Insights card drill |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-X14 | /cancellation-insights full page |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y01 | ⌘K / Ctrl+K opens the palette from any page |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y02 | Header search bar opens the palette |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y03 | Parallel search across 4 entity types with grouped labels |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y04 | Breadcrumb context per result row |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y05 | Input debounced ~200ms |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y06 | Top 5 per group + "See all N results" expansion |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y07 | Footer "View all in <domain>" → prefilled list page |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y08 | Selecting a result navigates directly |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y09 | Keyboard navigation (↑/↓/↵/Esc) + focus trap |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y10 | Non-admin rejected (permission scoping) |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y11 | Secret settings values never shown |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Y12 | Empty + no-results states |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z01 | Health strip renders below title, above Action Center |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z02 | Six indicators with colored dots + labels + values |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z03 | Dot color reflects configurable thresholds |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z04 | Clicking an indicator navigates to its detail page |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z05 | Failed Payouts deep-link pre-filters to failed |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z06 | Thresholds tunable via /config (health) without code change |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-Z07 | Dashboard embeds Action Center below the strip |  | NEVER RUN |  |  | NEVER RUN |  |
| ADM-TC-N2 | Financial audit journal viewable per trade |  | NEVER RUN |  |  | NEVER RUN |  |

### SUB (Subscriptions/Payouts/SP Wallet) — 100 cases

| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |
|---|---|---:|---|---|---|---|---|
| SUB-TC-A01 | Subscription Plans screen — Free vs Kids Club+ cards |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-A02 | Plan Comparison table — feature-by-feature + POPULAR badge |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-A03 | Dynamic pricing & fees pulled from admin config |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-A04 | Current plan reflected (button disabled / "Current Plan") |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-A05 | Kids Club+ Overview screen by subscription status |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B01 | 🔴 RETIRED — in-app payment removed; web-first → SUB-TC-N01/N02 + Web Subscription Purchase E2E (QA Task 20) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B02 | 🔴 RETIRED — in-app payment screen removed; coverage → Web Subscription Purchase E2E (QA Task 20) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B03 | 🔴 RETIRED — in-app Success screen removed; coverage → Web Subscription Purchase E2E (QA Task 20) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B04 | 🔴 RETIRED — in-app trial-gating removed; server-side trial config → QA Task 20 finding F-3 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B05 | 🔴 RETIRED — in-app trial-disabled alert removed; coverage → QA Task 20 finding F-3 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B06 | 🔴 RETIRED — ContinueKidsClub is deep-link-only; see SUB-TC-N03–N06 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B07 | 🔴 RETIRED — referral bonus-loss warning on removed Subscription Choice; see SUB-TC-N03 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B08 | 🔴 RETIRED — in-app trial-limit CTA removed; config reflection → SUB-TC-R05 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B09 | 🔴 RETIRED — in-app Stripe sheet removed; checkout UX → QA Task 20 scope 2 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B10 | 🔴 RETIRED — in-app decline handling removed; checkout decline → QA Task 20 scope 2 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B11 | 🔴 RETIRED — in-app saved-card resub removed; cards on file → Group M |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B12 | 🔴 RETIRED — in-app payment network-error path removed; → QA Task 20 scope 2 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-B13 | 🔴 RETIRED — in-app Apple/Google Pay removed; web wallet-pay → QA Task 20 scope 2 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-C01 | My Subscription screen — paid member view |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-C02 | My Subscription quick menu (Billing / Payment / Help) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-C03 | Manage Kids Club+ — status, next billing, days remaining |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-C04 | Cancel flow — retention screen "Keep My Benefits" |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-C05 | Cancel reason modal + final confirmation |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-C06 | Cancelled subscription stays active until period end |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-C07 | Auto-renew toggle / update payment method |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-C08 | Manage Kids Club+ free/no-subscription state |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-C09 | Manage Kids Club+ expired state |  | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | ✅ PASS |  |
| SUB-TC-C10 | My Subscription free-user state |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-C11 | My Subscription "Learn More" link |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-C12 | My Subscription "Member Since" value (latent bug) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-D01 | Grace period banner + SP wallet frozen warning |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-D02 | 🔴 RETIRED — in-app re-subscribe payment removed; web-first → SUB-TC-N01/N02 + Web E2E |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-D03 | Subscription Expired screen — benefits lost + Renew |  | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | ✅ PASS |  |
| SUB-TC-D04 | 🔴 RETIRED — in-app renewal payment removed; web-first → SUB-TC-N01/N02 + Web E2E |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-D05 | Reactivate from cancelled state |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-D06 | 📦 moved to Fixture-Gated Backlog (clock/push fixture) |  | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| SUB-TC-D07 | 📦 moved to Fixture-Gated Backlog (clock/push fixture) |  | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| SUB-TC-E01 | Billing History list — records, status badges, amounts |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-E02 | Billing History empty state |  | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| SUB-TC-E03 | Failed charge shows error message |  | FAIL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🔴 STILL OPEN | FAIL, unresolved |
| SUB-TC-E04 | ⏸ FIXTURE-GATED (push-payload) — Subscription Status screen diagnostics |  | PASS | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | ✅ PASS |  |
| SUB-TC-F01 | Payout Settings hero — Available / Pending / Lifetime Earned (live) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-F02 | Payout method section (add vs existing) — live |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-F03 | Payout history list (completed / pending) — live |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-F04 | Earnings figures (Available/Pending/Lifetime) + history net/fee — live |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-F05 | Payout history empty state — live |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-F06 | Pending earnings figure follows admin release timing — live |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-F07 | Payout load error + recovery — live |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-F08 | Payout history Load More pagination (+5) — live |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G01 | Add Stripe Connect payout method (onboarding) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G02 | 🚫 N/A — PayPal/Venmo unconfigured provider (UI lists, not drivable) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G03 | 🚫 N/A — Bank ACH unconfigured / no UI option |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G04 | Set primary method / delete method (confirmation) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G05 | Unverified method blocks payout (live: cannot set primary / withdraw) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G06 | requires_action payout → "Set Up Payout Method" |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G07 | Payout Settings — "Edit Details" sheet |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G08 | "Cannot Delete Primary/Only Method" guard |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G09 | "Cannot Set as Primary" (unverified) guard |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G10 | Payout history Load More |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-G11 | NoMethodModal flow |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-H01 | Withdraw Now — no-balance guard (amount entry removed) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-H02 | WithdrawModal summary — Available / Payout Fee / You'll Receive |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-H03 | Confirm Withdrawal success |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-H04 | Withdraw blocked when no verified primary method |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-H05 | Withdraw Now from Payout Settings hero (verified template) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-H06 | Admin minimum withdrawal blocks full-balance requests below the floor |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-H07 | Minimum withdrawal disabled when config = 0 |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-I01 | SP Wallet hero balance + lifetime stats |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-I02 | Quick actions (Shop / Sell / History) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-I03 | How to Earn SP section + Learn More |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-I04 | SP expiration info + expiring-soon alert |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-I05 | Wallet warning banner by state (active/grace/expired) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-I06 | Free user SP wallet inactive state |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-I07 | SP Wallet — "Reserved in trades" card |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-I08 | SP Wallet — "Wallet Not Found" error |  | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| SUB-TC-I09 | SP Wallet — pending-release summary note |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-J01 | SP History tabs (All / Earned / Spent) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-J02 | Transaction rows — type icon, label, signed amount |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-J03 | Empty state per tab |  | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| SUB-TC-J04 | Pull-to-refresh updates ledger |  | BLOCKED | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🔴 STILL OPEN | BLOCKED (env/fixture) |
| SUB-TC-K01 | Transaction History list + status badges |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-K02 | Transaction History empty + error/retry |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-L01 | Renewal webhook → billing + member state — **LIVE PASS** (QA Task 21: real test-clock renewal advanced `current_period_end` + wrote `billing_history` row) |  | PARTIAL | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🟡 PARTIAL |  |
| SUB-TC-L02 | Payment-failed webhook → retry/grace — **PARTIAL** (mechanism live-subscribed; no live failing-renewal fixture driven) |  | PARTIAL | 2026-09-03 | `qa-task25-consolidated-2026-09-03` | 🟡 PARTIAL |  |
| SUB-TC-L03 | Invalid webhook signature rejected — **PARTIAL** (source+deployed parity; negative-signature POST not driven) |  | PARTIAL | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🟡 PARTIAL |  |
| SUB-TC-L04 | Duplicate webhook delivery idempotent — **LIVE PASS** (QA Task 21: 4 webhook events → ONE `subscriptions` + ONE `subscription_events` row) |  | PARTIAL | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🟡 PARTIAL |  |
| SUB-TC-L05 | Payout-status webhook updates seller payout history (payout domain) |  | PARTIAL | 2026-09-02 | `qa-task21-sub-close-2026-09-02` | 🟡 PARTIAL |  |
| SUB-TC-M01 | Payment Methods — loading state |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-M02 | Empty state + Add Payment Method (Stripe sheet) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-M03 | Saved-card display + security banner |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-M04 | Update Payment Method |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-M05 | Remove This Card (confirm + success) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-M06 | Go Back |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-M07 | Backend contract — attach / detach / retryFailedPayment branches |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-N01 | JoinKidsClub value-prop + web CTA |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-N02 | JoinKidsClub web redirect (passitup.com) |  | PASS | 2026-09-02 | `qa-task19-sub-kickoff-2026-09-02` | ✅ PASS |  |
| SUB-TC-N03 | Route-alias reachability (JoinKidsClub vs deep-link-only aliases) |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-N04 | ContinueKidsClub active-subscription variant |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-N05 | ContinueKidsClub loading state |  | NEVER RUN |  |  | NEVER RUN |  |
| SUB-TC-N06 | ContinueKidsClub trial-ending urgency badge |  | NEVER RUN |  |  | NEVER RUN |  |

## 4 · TRD reconciliation detail (from 278 → 288 canonical today)

- v1 (2026-08-24) reported **TRD 278 cases, 0 run**. That is stale twice over: (a) the guide has since grown to **288** IDs (Groups N2, O1/O2/O3, S, T, U, V, W, X, Y, Z added after v1), and (b) **19 TRD execution runs (2026-08-26 → 09-02) now sit on disk.**
- Of the **288** canonical TRD IDs, this snapshot gives a verdict to **269** cases. Of those, **234 PASS**, **28 PARTIAL** (source-confirmed/partial/fixture), **2 STILL OPEN** (real residual defects/fixture-gated), **3 doc-drift**, **2 SKIPPED**.
- **Genuinely never-run under their canonical ID: 19** — A03/A04 (Accept-SP-listing / Donate), B12/B13 (not-wired/dead-code flags), D05/D06 (post-MVP), E05/E06 (admin dispute Complete/Refund — same behavior PASS under R10/R09), N2 (idempotency cross-cutting), Q10/Q11/Q13/Q14/Q16 (time/multi-account descoped), R01–R05 (refund-settlement re-spec — equivalent PASS under B04/B01/C02/B02/C03/B06/C06). These are honest never-runs or descoped, not silent gaps.

### Notable TRD STILL-OPEN / PARTIAL items (real residual findings, not stale)

| TC | Status | Latest | Finding |
|---|---|---|---|
| TRD-TC-N07 | 🔴 STILL OPEN | 2026-09-02 | FLAG: needs auto-paused sub-min $4 listing fixture (R41); positive leg not driven |
| TRD-TC-V01 | 🔴 STILL OPEN | 2026-08-31 | bottom-tab label 'Basket' not 'Trade Basket' (real copy defect; X01 same) |
| TRD-TC-B02 | 🟡 PARTIAL | 2026-08-28 | expiry mechanics + History PASS; residual F1 'offer_expired' vs 'Offer expired' string mismatch (reverify-a02-b02-b06 flagged FAIL) |
| TRD-TC-B10 | 🟡 PARTIAL | 2026-09-02 | attach/persist code-path verified (same path as DT83 D2 PASS); literal new-card entry native-sheet tooling-limited |
| TRD-TC-H05 | 🟡 PARTIAL | 2026-08-29 | trial-start leg not on-device reachable (trial_enabled=false); state machine source-verified |
| TRD-TC-J01 | 📄 DOC-DRIFT | 2026-08-29 | guide-drift: Level-1 seller-cancel alert removed per TFV2-023; backend count 0→1 verified |
| TRD-TC-J02 | 📄 DOC-DRIFT | 2026-08-29 | guide-drift: Level-2 alert removed; backend count 1→2 verified |
| TRD-TC-J03 | 📄 DOC-DRIFT | 2026-08-29 | guide-drift: Level-3 alert removed; backend 2→3 + admin flag verified |
| TRD-TC-M16 | 🟡 PARTIAL | 2026-08-30 | toast 2.5s window; source-corroborated |
| TRD-TC-M18 | 🟡 PARTIAL | 2026-08-30 | toast; source-corroborated |
| TRD-TC-N03 | 🟡 PARTIAL | 2026-08-30 | min listing price config-write leg 0→5→0 verified |
| TRD-TC-O07 | 🟡 PARTIAL | 2026-08-31 | backend proportional tax refund DB-verified; end-user refund-detail UI deferred (guide ⏭️) |
| TRD-TC-O1 | 🟡 PARTIAL | 2026-08-30 | /tax/rules admin surface confirmed (O1-C1..C17) |
| TRD-TC-P02 | 🟡 PARTIAL | 2026-08-30 | no bulk-node UI exists; matches guide defer |
| TRD-TC-P03 | 🟡 PARTIAL | 2026-08-30 | rules version history; no node change-history UI |
| TRD-TC-R07 | 🟡 PARTIAL | 2026-08-30 | source-confirmed SP reversal mechanism; SP in-progress cancel not UI-driven |
| TRD-TC-R08 | 🟡 PARTIAL | 2026-08-30 | no seller_payouts on cancel/void (re-confirmed) |
| TRD-TC-R09 | 🟡 PARTIAL | 2026-08-30 | dispute queue verified; resolve→Refund money-flow fixture-gapped |
| TRD-TC-S03 | 🟡 PARTIAL | 2026-08-30 | hide gate source-confirmed; no single-listing-seller fixture |
| TRD-TC-S06 | 🟡 PARTIAL | 2026-08-30 | matchesBanner source-verified |
| TRD-TC-S08 | 🟡 PARTIAL | 2026-08-30 | 1-item CTA source-confirmed |
| TRD-TC-S10 | 🟡 PARTIAL | 2026-08-30 | bundle banner bundleMode source |
| TRD-TC-S11 | 🟡 PARTIAL | 2026-08-30 | discover grid unchanged source |
| TRD-TC-S12 | 🟡 PARTIAL | 2026-08-30 | single-offer flow unchanged source |
| TRD-TC-S15 | 🟡 PARTIAL | 2026-08-30 | same hide gate as S03 |
| TRD-TC-S16 | 🟡 PARTIAL | 2026-08-30 | banner doesn't disrupt badge source |
| TRD-TC-S18 | 🟡 PARTIAL | 2026-08-30 | count recalc source |
| TRD-TC-S19 | 🟡 PARTIAL | 2026-08-30 | hidden when all in basket source |
| TRD-TC-S22 | 🟡 PARTIAL | 2026-08-30 | seller card unchanged source |
| TRD-TC-S24 | 🟡 PARTIAL | 2026-08-30 | return-to-cart nav source |
| TRD-TC-T03 | 🟡 PARTIAL | 2026-08-31 | wallet-limited path w/ actual balance 4; guide 8-SP scenario not reproducible; DT72 phrasing verified |
| TRD-TC-T11 | 🟡 PARTIAL | 2026-08-31 | SP transfers at COMPLETION by design (D-17); completion-time release verified across A02/C05/Z05 runs |
| TRD-TC-V13 | 🟡 PARTIAL | 2026-08-31 | alert copy verified; favorites-screen trigger not driven |

## 5 · Evidence register summary

- Parsed **124 evidence files** → **1,362 verdict rows** (manual 824 incl. decision logs; automated 538 incl. results.json).
- **TRD execution runs on disk (19):** `trd-a01-a02-2026-08-26`, `trd-part2-2026-08-27`, `qa-trd-group-a-b-2026-08-28` (the 20-case Group A/B 'Full Decision-and-Outcome Log' — 9 PASS/2 FAIL/4 BLOCKED/5 SKIPPED + P1), `qa-trd-b-c-d-e-2026-08-28` (Task 4), `qa-trd-b05e-j-admin-deps-2026-08-28`, `qa-trd-b01-b02-reverify-2026-08-28`, `qa-trd-reverify-a02-b02-b06-2026-08-28`, `qa-task5-trd-f-k-2026-08-29`, `qa-task6-e-reverify-2026-08-29`, `qa-task7-expanded-lmn-retest-2026-08-30`, `qa-task8-cumulative-regression-2026-08-30`, `qa-task9-dt63-fix-verify-2026-08-30`, `qa-task10-dt66-fix-verify-tr-d-2026-08-30`, `qa-task11-nopqr-2026-08-30`, `qa-task12-close-2026-08-30`, `qa-task13-dt71-dt72-verify-2026-08-31`, `qa-task14-dt73-u-y-2026-08-31`, `qa-task15-dt75-w-t-2026-08-31`, `qa-task16-close-trd-2026-08-31`, `qa-task17-z-g-dt78-81-2026-09-01`, `qa-task18-close-trd-2026-09-02`.
- Intermediate artifacts: `temp/tc-inventory-v2/` (master-tcs-v2.tsv, master-unique-v2.tsv, report-evidence-v2.tsv, report-register-v2.tsv, canonical-latest-v2.tsv, scan_evidence_v2.py, reconcile_v2.py).

## 6 · Legacy automated-suite evidence (NOT merged into canonical rows)

Pre-prefix `TC-*`/`REG-R*` runs (May–Jun 2026) and the 2026-08-27 `results.json` runs (harness login-gate all-fail) are excluded from the canonical verdicts above by the method's scope rule. They remain listed as unmatched evidence in `temp/tc-inventory-v2/unmatched-evidence-v2.tsv` (non-canonical IDs) and are only cited where a canonical case has no manual row.

