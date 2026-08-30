# QA Task 10 — Dev Task 66 Fix-Verify (6/6) + TRD Groups N/O-Partial Coverage Attempt (Rev 2)

- **Date:** 2026-08-30
- **Run folder:** `e2e-test-results/qa-task10-dt66-fix-verify-tr-d-2026-08-30/`
- **Surface:** iOS mobile app (`Pass It Up!`, `com.sameralzubaidi.p2pmarketplace`, iPhone 17 Pro Max sim `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`)
- **Backend:** Supabase staging `drntwgporzabmxdqykrp`
- **Method:** Real on-device interaction, disposable fixtures, DB read-backs closing every money/state assertion (R11/R24), Dev Task 51/65 tooling (`qa-login-as`, `qa:admin-config-set`, `qa:ef-repro`, `qa:reset-offer-fixtures`).
- **Personas:** test-buyer (`49243010-…`), test-seller (`14be337c-…`, trial), test-grace (`a1234567-…-011`).
- **HEAD:** `f30fd108` (Dev Task 66 — QA Task 9 Findings Batch).

---

## Roll-up verdict

| # | Item | Verdict | Key assertion |
|---|---|---|---|
| 1 | **Grace-period subscriber logic** — spend-side kept, earn-side blocked | ✅ **PASS** | `is_active_subscriber(test-buyer)=true` (lapsed period + future grace — the original stale-fixture symptom), `test-grace=true`, `test-seller(trial)=true`; `is_earning_subscriber=false` for both grace personas. On-device: **"Accepts Points · Up to 9 SP"** badge shows for test-buyer AND test-grace (was hidden pre-DT-66); Swap Points Eligible banner + $1.49 member fee shown. All 3 earn functions (`issue_starter_pack`, `award_referral_sp`, `award_listing_referral_sp`) wired to the strict `is_earning_subscriber` predicate (functiondef-verified). |
| 2a | **IssueReportModal container AX** — DT-66 fix on-device | ⚠️ **PARTIAL** | All children (5 reasons, submit, cancel) fully AX-exposed; **container `issue-report-modal`/"Report an Issue dialog" still does NOT surface** despite `accessible`+`alert`+`label` in source. Same BP-53 container class as QA Task 9. |
| 2b | **cancel-reason-modal container AX** — DT-66 fix on-device | ⚠️ **PARTIAL** | Same result: children (6 reasons, keep, confirm) fully AX-exposed; **container `cancel-reason-modal`/"Cancel Reason dialog" does NOT surface**. |
| 3 | **cart_min_value_cents server-side validation** | ✅ **PASS** | `qa:admin-config-set set -5` → `NEGATIVE_MONEY_VALUE: key=cart_min_value_cents must be >= 0, got -5` (rejected; value stayed 0). Positive 5 writes fine. Reverted to 0 (verified). |
| 4 | **"Request to Buy" owner gating** | ✅ **PASS** | On test-seller's own listing: neither Add to Cart nor Request to Buy render (owner sees "You cannot view your own seller profile here" + bundle hint). Resolves QA Task 9 finding #4. |
| 5 | **SAVED_CART_LIMIT_REACHED friendly copy** | ✅ **PASS** | Built 3 saved carts + active via UI. Save path: "Could not save cart / **You already have 3 saved carts. Delete one to save a new one.**" Switch path: "Could not switch / **You already have 3 saved carts…**". NO raw string either path (was `SAVED_CART_LIMIT_REACHED: user already has 3 saved carts`). |
| 6 | **M20 guide color fix** | ✅ **PASS** | Guide `MODULE-15.1.2` L2905 now reads "neutral-gray heart icon … accessibility label 'View Favorites'". On-device `discover-header-favorites` present. |

**Fix-verify roll-up: 5 PASS · 1 PARTIAL (both modal containers — DT-66 item 2 not delivering on-device) · 0 FAIL · 0 BLOCKED.**

---

## Coverage attempt (Groups N/O) — honest outcome

| Group | Cases | Verdict | Reason |
|---|---|---|---|
| **N** — Cart/Bundle Admin Thresholds (N03-N14) | 12 | **NOT EXECUTABLE this session** | ItemCreate form friction (keyboard not dismissible, scroll binary-snaps) blocks the below-threshold publish-flow cases (N04/N05/N09-N14); N06's auto-pause lives in `secure_upsert_admin_config` (admin-web/API path — out of scope for this mobile agent per §2, and the `qa:admin-config-set` helper uses `upsert_admin_config_setting` which does NOT auto-pause). N03 config-write leg verified via the helper (0→5→0, read-back). |
| **O** — Sales Tax Engine (O01-O08 + O1/O2/O3) | 11 | **PARTIAL evidence** | O01 (tax in checkout breakdown) confirmed on-device ($1.40 on $20 @ 6.99% CT); O08 (tax on buyer timeline) source-verified (`timeline-payment-tax-row`, buyer-only); O03/O04/O05/O06/O07 + O1/O2/O3 not executed (need new trade fixtures / admin-web config surfaces). |

Per the task's explicit graceful-degradation instruction, a smaller fully-verified zero-residue batch (the 6 fix-verifications) was completed over a degraded full one. **All 60 new coverage cases remain "NEVER RUN" in the master tracker; no partial/incorrect verdicts were recorded for them.**

---

## Per-case detail

### 1. Grace-period subscriber logic — ✅ PASS
- **DB (read-only):** `is_active_subscriber()` grace-aware — test-buyer (status `active`, `current_period_end` 2026-07-27 PAST, `grace_ends_at` 2026-09-12 FUTURE) = **true**; test-grace (status `grace`, grace_ends 2026-10-27) = **true**; test-seller (trial, ends 2026-09-01) = true; test-free = false. `is_earning_subscriber()` strict — test-buyer/test-grace = **false**; test-seller = true; test-free = false.
- **Function wiring (pg_get_functiondef):** `rpc_cart_get_items` uses grace-aware `is_active_subscriber`; `issue_starter_pack`, `award_referral_sp`, `award_listing_referral_sp` all use strict `is_earning_subscriber`.
- **Client:** `get_subscription_status` returns `grace` for test-grace → `getSubscriptionSummary.is_subscriber=true` (spend-side).
- **On-device spend-side (the exact QA Task 9 stale-fixture symptom):** test-buyer's cart showed **"Accepts Points · Up to 9 SP"** (`cart-item-open-27ef99ee…`) — the subscriber badge that was HIDDEN in QA Task 9. test-grace's cart also showed **"Accepts Points · Up to 9 SP"** (`cart-item-open-7fda24ca…`) — a genuine grace-status persona retains the spend-side badge. Both saw the "💫 Swap Points Eligible" banner and the $1.49 member "Safety & Platform Fee" (member tier, not the $20 non-sub tier).
- **Earn-side:** DB predicates + all 3 earn functions wired to `is_earning_subscriber` (grace can never earn starter pack / referral SP). On-device earn-driving (a full grace trade completion) not performed — DB+source proof is conclusive for the earn-side split.
- **Verdict:** the DT-66 item-1 fix is verified end-to-end: the stale-fixture state that hid the badge now shows it, and the earn-side is blocked for grace.

### 2a. IssueReportModal container AX — ⚠️ PARTIAL
- Reached via a real in-progress trade (`17a655b3`, buyer timeline → Report Problem → IssueReportModal).
- **On-device AX tree:** all 5 reasons (`issue-reason-*`), `issue-submit-button`, `issue-cancel-button` fully exposed (BP-53 conformant; screen-reader users can operate the modal).
- **BUT the container `testID="issue-report-modal"` + `accessibilityRole="alert"` + `accessibilityLabel="Report an Issue dialog"` did NOT surface** as a distinct AX element on two listings. Same result as QA Task 9 (which was pre-DT-66). **The DT-66 fix for this modal is NOT delivering the alert-role announcement on-device.**
- **Fix recommendation (dev):** the `accessible`+`alert`+`label` combo on a sheet `<View>` that wraps other accessible children is still flattened on iOS. Recommend moving the alert role onto a genuine accessibility element (or testing whether `accessibilityElementsHidden`/grouping is needed), and re-verifying on-device.

### 2b. cancel-reason-modal container AX — ⚠️ PARTIAL
- Reached via test-seller (trial) → Manage Kids Club → Cancel Kids Club+ → modal. (`canCancel = isTrial || isActive` — grace users can't reach it, correct.)
- **On-device AX tree:** all 6 reasons (`cancel-reason-*`), `cancel-keep-button`, `cancel-confirm-button` fully exposed.
- **BUT the container `testID="cancel-reason-modal"` + `accessibilityRole="alert"` + `accessibilityLabel="Cancel Reason dialog"` did NOT surface** (two listings). Same class as 2a. **DT-66's claim that both modals were fixed is only partially delivered: children are exposed, the container/alert announcement is not.**

### 3. cart_min_value_cents server-side validation — ✅ PASS
- `qa:admin-config-set set --key cart_min_value_cents --value -5` → **`NEGATIVE_MONEY_VALUE: key=cart_min_value_cents must be >= 0, got -5`** — rejected at the RPC layer (was silently accepted in QA Task 9). Value stayed `0` (read-back).
- Positive `5` → writes + read-back matches. Reverted to `0` (read-back verified). `updated_by` preserved (`1a546991-…`).
- **Verdict:** the QA Task 9 N02 finding (admin-UI-only guard) is resolved server-side by DT-66's `fn_validate_admin_config_money` (RPC + trigger).

### 4. "Request to Buy" owner gating — ✅ PASS
- As test-seller, opened own listing (Puzzle Set): the CTA area shows only "You cannot view your own seller profile here" + the bundle hint — **no Add to Cart, no Request to Buy** (both gated by `user?.id !== listing?.seller_id`).
- **Verdict:** the QA Task 9 finding #4 (Request to Buy reachable on own listings, server-blocked `SELF_PURCHASE` flow) is resolved.

### 5. SAVED_CART_LIMIT_REACHED friendly copy — ✅ PASS
- **Fixture:** built 3 saved carts (Puzzle $18 / Vintage Comic $25 / QA Canned $20) + a 4th active cart (Cash-Only $20) via the UI.
- **Save path:** 4th save → **"Could not save cart / You already have 3 saved carts. Delete one to save a new one."** (friendly; no raw string).
- **Switch path:** with 3 saved + 1 active, tapping Switch → confirm modal ("Your current active cart will be saved and the selected cart will become active.") → **"Could not switch / You already have 3 saved carts. Delete one to save a new one."** — the friendly copy via the RPC's structured error + `CartScreen.confirmSwitchCart` safety net (QA Task 9's raw-string bug is gone).
- **Verdict:** verified on-device end-to-end (not just source/take-at-face-value).

### 6. M20 guide color fix — ✅ PASS
- Guide `MODULE-15.1.2` L2905 now correctly describes the **neutral-gray heart** ("A neutral-gray heart icon button is visible in the Discover header controls row (consistent with the header icon system) with accessibility label 'View Favorites'.").
- On-device: `discover-header-favorites` (a11y "View Favorites") present in the Discover header (cross-checked during FV1).
- **Verdict:** doc drift from QA Task 9 (guide said "pink/red heart") resolved.

---

## Perceived load-time table (simulator, wall-clock, ±polling-interval precision)

| Screen/transition | Elapsed | Flag |
|---|---|---|
| Discover → Item Detail (deep link) | ~1-2s | — |
| Item Detail → Make Offer | ~1s | — |
| Send Offer → Trade Initiated | ~2-4s | — |
| Seller Review Offer → Accept → "Offer Accepted!" | ~3-4s | ⚠️ ~3s (EF latency, acceptable for a paid action; loading feedback shown) |
| Trade Timeline → Report Problem → IssueReportModal | ~1-2s | — |
| Cart → Save cart confirm | ~1s | — |

## Cross-cutting UX findings (wording/structure)
1. **ItemCreate form (Group N blocker):** the below-threshold publish modal "Let's Adjust Your Price" was NOT reached due to form friction (keyboard not dismissible on the price field, ScrollView binary-snapping). The modal source (`price-adjustment-update-btn`, title "Let's Adjust Your Price") is confirmed present. This is a **tooling/session friction** blocking N04/N05/N09-N14, not an app defect — recommend a dev fixture to set a below-threshold price in one tap (mirror `dev-fill-item`) to unblock these cases for automation.
2. **Grace display inconsistency (info):** test-grace's Home shows the free-tier SP strip ("0 SP / Earn More →") and Profile shows "Join Kid's Club", while the cart badge + member fee treat grace as a member. The DT-66 fix covers the money/spend paths; the Home/Profile *promotional* surfaces still render grace as non-member. Low-severity display inconsistency; the money/spend-side semantics are correct.
3. **No raw error strings** surfaced anywhere this run (SAVED_CART_LIMIT path verified clean; NEGATIVE_MONEY_VALUE is a server error, not user-facing).

## Cross-cutting design-system compliance
- No deviations found on the screens/modals reviewed: Discover, Item Detail, Make Offer, Trade Basket, Manage Kids Club, CancelSubscription, Review Offer, Trade Timeline, IssueReportModal (warning icon amber `#D97706`, green Submit), cancel-reason-modal (red confirm per design). Headers use the canonical back button. Modals use the brand primary green `#5DBB8E` / destructive red `#FF6B6B`.

## Follow-up recommendations (dev — separate tasks, NOT applied in-run)
1. **Modal container AX (DT-66 item 2 NOT delivered on-device):** both `issue-report-modal` and `cancel-reason-modal` containers still don't surface in the iOS AX tree. Investigate the RN iOS container-exposure semantics (the `accessible`+`alert`+`label` combo on a wrapper of accessible children is flattened) and re-verify on-device.
2. **ItemCreate dev fixture:** add a `dev-set-price <n>` fixture (or extend `dev-fill-item`) so below-threshold publish cases (N04/N05/N09-N14) are drivable without fighting the keyboard/scroll.
3. **Grace promotional surfaces (low):** Home SP strip + Profile "Join Kid's Club" card treat grace as non-member while money/spend paths treat grace as member — decide the intended display for grace users on those surfaces.

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 10 — all 6 Dev Task 66 fix-verifications (grace-period subscriber logic; IssueReportModal + cancel-reason-modal container AX; cart_min_value_cents server-side validation; "Request to Buy" owner gating; SAVED_CART_LIMIT_REACHED friendly copy; M20 guide color) + an attempted start on TRD Groups N/O coverage.

**Design-System Compliance:** PASS — no design-system deviations found across the screens/modals visited (Discover, Item Detail, Make Offer, Trade Basket, Manage Kids Club, CancelSubscription, Review Offer, Trade Timeline, IssueReportModal, cancel-reason-modal). Primary green `#5DBB8E`, destructive red `#FF6B6B`, warning amber `#D97706` all used per the canonical reference.

**Perceived Load-Time Verdict:** FLAGGED — [Review Offer → Accept → "Offer Accepted!"]: ~3-4s (see load-time table). Loading feedback was shown; the seller-accept is a paid capture action with expected EF latency. No sub-3s UX issues beyond that.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Discover: neutral-gray heart + "View Favorites" a11y label (M20 doc now matches).
- CONFIRMED — Item Detail / Make Offer: SP Eligible banner, price breakdown (item price, $1.49 member Safety & Platform Fee, Sales Tax, total), clear parent-friendly copy.
- CONFIRMED — Trade Basket: "Accepts Points · Up to N SP" subscriber badge, saved-cart rows with Switch, friendly SAVED_CART_LIMIT_REACHED copy on both save and switch paths.
- CONFIRMED — Manage Kids Club / Cancel Subscription: clear status + benefit-loss copy, "Let's Adjust Your Price" modal title (source-verified), cancel-reason rows.
- CONFIRMED — Review Offer: "Offer Accepted! Payment captured. Trade is now in progress." clear success copy.
- CONFIRMED — IssueReportModal: "Report an Issue / What went wrong with this trade?" + clear reason rows (parent-appropriate).

**Verdict Summary:** 5 PASS / 0 FAIL / 1 PARTIAL (modal container AX — covers BOTH IssueReportModal + cancel-reason-modal) / 0 BLOCKED / 0 SKIPPED for the fix-verifications. 60 new coverage cases NOT executed (Group N high-friction; Group O partial evidence) — no verdicts recorded for them (master tracker stays NEVER RUN).

**Critical Findings:**
1. **[MOD] DT-66 item 2 (modal container AX) is NOT delivered on-device — both modals:** `issue-report-modal` and `cancel-reason-modal` containers still don't surface as distinct AX elements despite `accessible`+`accessibilityRole="alert"`+`accessibilityLabel` in source. Children are fully AX-exposed and operable; the alert-role announcement is not delivered. Same BP-53 container class as QA Task 9. Recommend re-investigating the RN iOS container-exposure approach and re-verifying.
2. **[LOW] Grace promotional-surface inconsistency:** test-grace's Home shows the free SP strip and Profile shows "Join Kid's Club", while the cart badge + member fee treat grace as a member. Money/spend semantics are correct (DT-66); only the Home/Profile promotional rendering is inconsistent.
3. **[TOOLING] ItemCreate form friction blocks Group N publish-flow cases:** keyboard on the price field is not dismissible this session (Cmd+K/osascript unreliable even with Simulator focus; keyboard-done accessory not rendered for that field), and the ScrollView binary-snaps. Recommend a `dev-set-price` fixture to make N04/N05/N09-N14 drivable.

**App State Left Behind:** Zero residue (all verified via read-only SQL): 0 `cart_items`, 0 pending/in-progress offers (test-buyer + test-seller), `cart_min_value_cents=0`, `min_listing_price=0` (reverted to original `fees` category), no new items/drafts, item `04662c2c` back to `available`. The disposable in-progress trade `17a655b3` was cancelled via the `cancel-trade` EF (refund `cancelled_pi_…`, item restored). test-buyer's subscription left at baseline (the grace-aware `is_active_subscriber` now correctly returns true — no fixture hack needed). `payment_card` QA toggle disarmed. App logged out; simulator left clean.

**Why It Matters:** This run proves 5 of the 6 Dev Task 66 fixes are live and correct on-device with DB read-backs (grace spend/earn split incl. the original QA Task 9 stale-fixture symptom, server-side money guard, owner CTA gating, friendly saved-cart copy, M20 doc fix) — and surfaces that the 6th (modal container AX) is only partially delivered: the DT-66 source fix does not translate to the iOS AX tree for either modal. It also documents why Group N is not yet automatable (ItemCreate keyboard/scroll + admin-web-only auto-pause) so the dev tooling can unblock it.

**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task10-dt66-fix-verify-tr-d-2026-08-30/screenshots/` (FV1-01..04 badges, FV2-04/11 modals, FV4-01 owner gating, FV5-05/09 friendly copy, N04-* form friction). Repro each: FV1 — log in as test-buyer/test-grace, add an SP item, check the cart badge; FV3 — `npm run qa:admin-config-set -- set --key cart_min_value_cents --value -5` (expect NEGATIVE_MONEY_VALUE) then revert to 0; FV4 — as test-seller open own listing, confirm no buy CTAs; FV5 — build 3 saved carts + active, then save/switch (expect the friendly copy); FV2 — open IssueReportModal on an in-progress trade and inspect the AX tree for `issue-report-modal`.

**Known Gaps / Not Tested:** The 60 new Group N/O/P/Q/R coverage cases were not executed this session (Group N friction + admin-web dependencies; Groups P/Q/R need admin-web or completed-trade fixtures). The modal containers' VoiceOver announcement utterance is not tool-testable (AX-tree exposure is; the container is absent from the tree). The earn-side on-device leg (a full grace trade completion) was not performed — the DB predicate + function-wiring proof is conclusive.

**What Needs To Be Fixed Next:**
- Fix: DT-66 modal container AX — investigate why `accessible`+`alert`+`label` on the sheet wrapper still flattens on iOS (both `issue-report-modal` and `cancel-reason-modal`); move the alert role to a genuine accessibility element and re-verify on-device.
- Fix (tooling): add a `dev-set-price <n>` fixture to ItemCreate (mirroring `dev-fill-item`) so the below-threshold publish-flow cases (N04/N05/N09-N14) are drivable; the current keyboard/scroll friction blocks them.
- Fix (low): decide the grace display on Home SP strip + Profile "Join Kid's Club" card (currently non-member promo while money/spend paths treat grace as member).
- Fix (doc/process): Group N's auto-pause (N06) requires the `secure_upsert_admin_config` path — note it as an admin-web/Playwright surface for coverage, not this mobile agent.

**UX Enhancement Ideas (optional, not defects):**
- On the cart "Make an offer" CTA (Trade Basket), the "bundle and save on fees" hint is static — consider showing the dynamic bundle fee saving ("Add X more item(s) to save $Y on fees") to reinforce the bundling benefit. (Observed the static copy on multiple cart states this run.)
- None other this run.

**Suggested Next Session:** Run the Group O tax batch (O01 checkout tax, O08 timeline tax, O03 global-disable) now that the tax model (6.99% CT `general_tangible_goods` category rate, `sales_tax_enabled` toggle) and the checkout/timeline flows are mapped; then re-attempt Group N once the `dev-set-price` fixture lands.

**Suggested to Improve Agent Rules:** none — the R37 `qa:admin-config-set` path, R24 DB read-backs, and the AX-first meta-rule all worked; the ItemCreate keyboard/scroll friction is a new data point for the known-scroll-blocker class (§5.9/§9), worth noting in the playbook's known-stale/friction list.
