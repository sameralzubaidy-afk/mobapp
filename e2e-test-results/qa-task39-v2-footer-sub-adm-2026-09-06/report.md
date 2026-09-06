# QA Task 39 v2 — Footer Verification + SUB Final 5 + ADM Closure Certification

**Date:** 2026-09-06 · **Project:** staging `drntwgporzabmxdqykrp` · **Device:** iOS Sim iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1) · Mobile HEAD `0a104881` (DT126, incl. the DT125 footer fix) · Admin portal :3001 up (not required this round)
**Run folder:** `e2e-test-results/qa-task39-v2-footer-sub-adm-2026-09-06/`
**Scope:** Batch A (DT125 footer fix re-verify — grace + expired branches) · Batch B (SUB-TC-N06 trial badge) · Batch C (SUB-TC-M06 Payment Methods Go Back) · Batch D (SUB-TC-M07 detach/remove) · Batch E (SUB-TC-M01 + N05 loading states) · Batch F (QA Task 31c ADM closure certification, read-only) · Cleanup. **R63–R76 applied throughout.** Not targeted (explicitly out of scope this session): TRD/AUTH/ACC backlog + ADM's 3 permanently-tooling-blocked cases (B03/B06/B07).

## Verdict summary

| Batch | Item | Verdict | Top finding |
|---|---|---|---|
| A | DT125 footer fix — grace branch | ✅ **PASS** | Floating tab pill ABSENT; both "Re-subscribe to Kids Club+" and "Go Back" fully visible, no scrolling (bottom-band OCR reads both). Footer Go Back functionally returns to Home. |
| A | DT125 footer fix — expired branch | ✅ **PASS** | Same — pill absent, both footer elements fully visible (code-identical footer shared by both branches). |
| B | SUB-TC-N06 (trial-ending badge) | 🔴 **BLOCKED (fixture defect)** | `qa:r41-trial -- ensure` fails: `subscriptions` has no `trial_started_at` column (staging column = `trial_start_date`, verified). Bug in TWO places in `scripts/qa/r41-trial-fixture.mjs`. App render logic source-confirmed correct. |
| C | SUB-TC-M06 (Payment Methods Go Back) | ✅ **PASS** | `pm-back-button` tap → returned cleanly to Settings. |
| D | SUB-TC-M07 (detach/remove branch) | ✅ **PASS** | Attach → Saved Card UI → Remove confirm → "Removed" alert → DB pm null → empty state. NEW MODERATE: remove doesn't invalidate the `getPaymentMethod` module cache (stale card on same-session remount). |
| E | SUB-TC-M01 (Payment Methods loading) | ✅ **PASS** | Loading spinner + "Loading payment methods..." **CAPTURED LIVE** on a cold re-enter. |
| E | SUB-TC-N05 (ContinueKidsClub loading) | ✅ **PASS** | Spinner **source-confirmed only** (transient — not live-catchable); resolved free branch on-device, on-brand. |
| F | ADM closure certification | ✅ **CERTIFIED** | All 160 canonical cases have a verdict or named exception. Recomputed split 143 PASS / 12 PARTIAL / 1 OPEN / 0 DRIFT / 1 SKIPPED / 3 Remaining = 160. **One genuine open: L02** (missing `category_sp_analytics` table). ADM section header R56-corrected (was 139/16). |

**Roll-up: 6 PASS / 1 BLOCKED (fixture) / 0 FAIL / 0 PARTIAL** (device rounds) + **Batch F = document certification** (read-only).

---

## Batch A — Dev Task 125 Footer Fix re-verify (BOTH PASS)

**Context:** QA Task 38's C-1 (MODERATE) found DT124 item 9's sticky grace footer occluded "Go Back" behind the floating `PersistentTabBar`. DT125 fixed it by adding `ManageKidsClub` to `TAB_BAR_HIDDEN_ROUTES` (verified in source: `PersistentTabBar/index.tsx` `TAB_BAR_HIDDEN_ROUTES` incl. `'ManageKidsClub'` + `ManageKidsClubScreen` graceFooter `paddingBottom: Math.max(insets.bottom, 12)`; unit test "renders nothing on the ManageKidsClub full-screen form (DT-125…)"). This batch re-verifies on-device.

**Grace branch (test-grace, `…-11`, status `grace`, grace_ends 2026-11-02):**
- `qa-login-as?persona=test-grace` → `manage-kids-club` deep link → Manage Kids Club+ grace branch.
- **AX tree contains NO tab-bar elements** (`tab-home`/`tab-discover`/… absent) → floating pill is gone on this screen.
- `resubscribe-kids-club-button` AX frame y827–878 (above the safe area).
- Screenshot + bottom-band OCR (`A1-01`, crop y2400–2868 px) reads exactly **"Re-subscribe to Kids Club+ / Go Back"** — both fully visible, **no scrolling**, no occlusion.
- Functional: tapped footer "Go Back" → returned to Home (dashboard greeting in tree). QA Task 38's PARTIAL is closed.

**Expired branch (test-expired, `…-13`, status `expired`, wallet frozen):**
- Login lands on the SubscriptionExpired gate → `manage-kids-club` deep link → Manage Kids Club+ expired branch.
- **No tab bar** in the tree; `resubscribe-kids-club-button` y827–878.
- Screenshot + bottom-band OCR (`A2-01`) reads **"Re-subscribe to Kids Club+ / Go Back"** — both fully visible. Same code-identical footer (`isGracePeriod || isExpired`), so the functional Go Back verified on grace applies.

**Locator gap (flag):** the footer "Go Back" is a plain `TouchableOpacity` (`onPress={() => navigation.goBack()}`, no `testID`/`accessible`/role) — not AX-exposed. Recommend a `testID` (e.g. `grace-footer-back-button`) as a BP-53-class instrumentation follow-up (R64). The Re-subscribe CTA has `testID="resubscribe-kids-club-button"`.

**Design/copy observations (minor):** expired status badge reads raw lowercase **"expired"** in a gray pill (vs grace's friendly **"Grace Period"** red pill) — inconsistent status-badge treatment on the same screen family; recommend a friendly mapped label ("Expired" / reuse the semantic error treatment). The grace/expired info boxes use canonical tokens (grace = #FFA726-on-#FFF3E0 warning; expired = #5B8FB9 info), which are on-brand.

**Evidence:** `A1-01` (grace full), `A1-00` launch, `A2-01` (expired full).

---

## Batch B — SUB-TC-N06 (trial-ending urgency badge) — BLOCKED on a fixture defect

**Attempted (the approved DT120 Phase-2 staging run):**
1. `npm run qa:r41-trial -- ensure` (default 5 days) → created the auth user + profile, then **failed**: `❌ subscriptions upsert failed: Could not find the 'trial_started_at' column of 'subscriptions' in the schema cache`.
2. Read-only schema check (`information_schema.columns` on `subscriptions`): the column is **`trial_start_date`** (all other columns the script writes — `status`, `trial_end_date`, `current_period_start`, `current_period_end`, `auto_renew_enabled`, `user_id`, `updated_at` — exist).
3. **Root cause:** `scripts/qa/r41-trial-fixture.mjs` references `trial_started_at` in **two** places: the subscriptions upsert object (~L213) and the `printStatus` select (~L258). This is a latent fixture bug — the fixture has evidently never completed a real run (consistent with "approved twice but never actually run").
4. Execution-only: I cannot patch the script. **One-line fix recommended (dev follow-up):** replace `trial_started_at` → `trial_start_date` in both spots, then re-run the approved plan.
5. Reset: `npm run qa:r41-trial -- reset` → **0 residue** (DB-verified).

**Source corroboration (R62c — the app behavior is correct once the fixture works):** `ContinueKidsClubScreen.tsx` L50-51 (`isTrialSubscription = status==='trial'`), L182-184 (`daysRemaining`, `trialEnding = daysRemaining <= 7`, `showDefaultTrialBadge = !isTrialSubscription`), L197-202 (urgency badge renders when trial && days ≤7 && >0: `"{N} {day|days} left in trial"`), L207-210 (default `"{trialDays} free days • no charge today"` pill only for non-trial). Matches the guide's N06 expected result exactly.

**Verdict:** N06 remains ACTIVE/BLOCKED-on-fixture (not closable this session). Tracker N06 note updated with the defect + fix.

---

## Batch C — SUB-TC-M06 (Payment Methods "Go Back") — PASS

test-buyer → Profile → App Settings → Manage Payment Methods → Payment Methods screen → tapped `pm-back-button` (AX `(188,746,62x43)`) → **returned cleanly to Settings** (screen-title "Settings" + ACCOUNT section in tree; screenshot `C1-02`).

- Note: test-buyer's Payment Methods first showed the **empty state** ("No Payment Method") despite a saved card on file (pre-existing R59 stale-fetch artifact — QA Task 38 documented the same on the Manage Kids Club+ section). Not relevant to M06's Go-Back assertion; a clean relaunch shows the saved card.
- The tap-through closes M06's functional leg (prior round was AX-exposure only).

**Evidence:** `C1-01` (Payment Methods start), `C1-02` (return to Settings).

---

## Batch D — SUB-TC-M07 (detach/remove branch) — PASS

**Disposable choice:** all four standing QA buyers (test-buyer/-free/-2/-3) already have shared cards on file (verified DB), so the brief's "second disposable login (not test-buyer's shared card)" pointed to a card-less disposable. Used **qa-wallet** (`…-f1`) — a standing disposable persona, `stripe_customer_id`/`payment_method_id` NULL at start, `qa-login-as`-able. Nothing shared was touched.

**Drive:**
1. Attach: Settings → Payment Methods (empty) → Add Payment Method → Stripe PaymentSheet → 4242 4242 4242 4242 / 12/30 / 123 / 12345 → Set up → **"Payment Method Saved / Your card was saved successfully."** (GlobalAlertProvider) — the `NO_FAILED_PAYMENT` → Payment-Method-Saved branch (qa-wallet is an active member with no failed payment). DB: `pm_1UCjoZ4I6kCJlvXo4jM8QE7r` on customer `cus_VDA6aCp5fY8Uci`. UI after fresh fetch: Saved Card VISA •••• 4242, exp 12/2030, `pm-update-button` + `pm-remove-button`.
2. Detach: tap `pm-remove-button` → confirm dialog **"Remove Payment Method / Are you sure you want to remove this payment method? … / Cancel / Remove"** (GlobalAlertProvider) → **Remove** → **"Removed / Your payment method has been removed."** → UI returned to **empty state**.
3. DB: `stripe_payment_method_id` → **null** (detach-payment-method EF fired and cleared the row).

**NEW MODERATE finding (F-1):** `getPaymentMethod` (`subscription.ts` L788+) keeps a module-level `_pmCache`; `PaymentMethodsScreen.handleRemovePaymentMethod` only calls `setPaymentMethod(null)` (local state) and never `getPaymentMethod(true)` to invalidate the cache. On a **same-session remount**, Payment Methods showed the **removed card again** (Saved Card VISA 4242) even though the DB was null; a clean relaunch (fresh module state) showed the true empty state. This is the mirror of the DT-81 attach-side cache-bypass fix — **remove must also invalidate `_pmCache`**. Any surface calling `getPaymentMethod()` without `forceRefresh` (Manage Kids Club+ PaymentMethodSection, CartCheckout, TradeOffer) can show/offer the removed card for the rest of the session. Fix: after a successful detach, call `getPaymentMethod(true)` (or clear `_pmCache`).

**Evidence:** `D1-01` Stripe sheet · `D1-02` filled card · `D1-03` attach-done stale-empty · `D1-04` attach success alert · `D1-05` saved card · `D1-06` remove confirm · `D1-07` removed alert.

---

## Batch E — SUB-TC-M01 + N05 (loading states)

- **M01 — CAPTURED LIVE.** After a clean terminate+relaunch (fresh module state), re-entering Payment Methods and screenshotting immediately caught the transient loading frame: green `pm-loading-spinner` + **"Loading payment methods..."** (evidence `E1-02`). The fetch then resolved to the true empty state. Source confirms the render (`PaymentMethodsScreen.tsx` L255-262: `if (loading) … <LoadingSpinner testID="pm-loading-spinner" /><Text>Loading payment methods...</Text>`).
- **N05 — SOURCE-CONFIRMED ONLY (stated plainly).** Fired `continue-kids-club` (test-free) and screenshot immediately, but the `getTrialStatus` fetch resolved within the deep-link→capture window — the transient "Loading..." spinner (`ContinueKidsClubScreen.tsx` L117-121) was not caught live. No QA throttle/slow toggle exists. Acceptable per the brief; the resolved Start Kids Club+ (free) branch rendered on-device (`E2-02`) and is **on-brand** (R62b source grep clean for active screens; R62c full-frame scan of `E2-02`: legacy `#4A7C59` = 0 px, grays at AA-noise baseline 0.02–0.08%, canonical green `#5DBB8E` 18.3%).

**R62b standing off-brand-hex grep (this run's design pass):** `grep -rEn "#4A7C59|#4D4D4D|#808080" p2p-kids-marketplace/src` → hits only in `SellerEarningsScreen.tsx` (9 — **dead/legacy** screen, superseded by Payout Settings), `LeaderboardScreen.tsx` (9 — **latent**, reachable only via a `leaderboard_rank_up` notification that doesn't exist), and one **BP-82 comment** in `ContinueKidsClubScreen.tsx` (not a style hit). No actively-navigated screen leaks a legacy hex.

**Evidence:** `E1-01` (M01 attempt — resolved state), `E1-02` (M01 spinner caught), `E2-01` (N05 attempt — resolved), `E2-02` (N05 resolved free branch).

---

## Batch F — QA Task 31c: ADM Closure Certification (read-only document audit)

**Source:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` ADM section (L663–863) + the ADM guide's canonical Test Case Index (`MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` L13–187).

1. **Every one of ADM's 160 cases has a verdict or a named permanent exception — YES.**
   - 157 canonical completed rows carry verdicts: **143 PASS / 12 PARTIAL / 1 OPEN / 0 DRIFT / 1 SKIPPED**.
   - 3 Remaining = **B03/B06/B07** — named permanent exceptions (ADM-R3 `prompt()`-tooling BLOCKED, each with a documented reason).
   - 143 + 12 + 1 + 0 + 1 + 3 = **160** ✓.
   - Inventory diff: guide index = 167 unique ADM-TC IDs (N2-A01…A08 sub-rows; F06b not in the index). Canonical 160 = 167 − 7 supplementary (N2-A02…A08). The tracker's 168 rows = all 167 indexed + F06b (tracker-only). **Diff-verified: zero guide-indexed IDs missing from the tracker.**
2. **ADM-R5 spot-check — HOLDS project-wide.** PASS rows the guide declares `admin, mobile` carry explicit mobile-leg evidence in their tracker notes across QA Task 30 / 31 / 31-M R3–R5 / QA Task 32-P2 (e.g. B04/L04/L05 wallet banners + balance 490→515→490; D02/D05–D10 category UI on-device; E02–E05 node/waitlist/radius mobile; I03/I04 both-parties' timeline reflection + realtime; G04 policy; M03/M04 Manage Active/Grace on-device; O04/P02/P03/R01/R03 mobile legs; C03–C10/X05/X06 buyer/seller visibility; Q01–Q06 profile review counts; N03/F08/L07/L08 mobile). The 2026-09-04 "mobile-leg owed" set has been progressively closed.
3. **Recomputed PARTIAL/OPEN/DRIFT/SKIP split (from the per-case rows):** canonical = **12 PARTIAL / 1 OPEN / 0 DRIFT / 1 SKIPPED** (the carried-forward estimate "21/1/0/1" is **stale** — it predates the QA Task 32/31-M PARTIAL→PASS flips; 13 PARTIAL if the supplementary N2-A08 is included).
4. **Roll-up sums to exactly 160** in the per-guide roll-up table (ADM row: 143/12/1/0/1/3) — verified against the per-case body once the 8 supplementary rows (N2-A02…A08 + F06b = 7 PASS + 1 PARTIAL) are excluded. **R56 finding:** the ADM **section header** was stale (PASS 139 / PARTIAL 16); corrected to 143/12 this round.
5. **Can ADM be declared fully closed (modulo the 3 permanently-blocked cases)?** **Effectively YES at the "every case has a verdict or named exception" bar — with ONE genuine open item and a small PARTIAL residual pool:**
   - **L02 (SP Analytics + CSV export) is STILL OPEN (FAIL)** — `public.category_sp_analytics` table is MISSING on staging; the data leg errors (shell + Export CSV render, no data). This is a **real dev fix** (create the table/view or re-point the query) + a re-verify, NOT tooling-blocked. **ADM is not "all green" until L02 is resolved.**
   - 12 PARTIAL rows carry documented reasons (fixture-gated: D04/D11/X08/X11; driver-limited: Y05; render/surface-only: S02/T01/X04/P04/O05/H05/N2-A08/M05) — each is a stated residual, not an unaccounted case.
   - S03 (Support reply) = SKIPPED (documented disposition).
   - B03/B06/B07 = the 3 named permanent exceptions (out of scope for future prioritization discussion, per the brief).

**Certification statement:** ADM's board is clean modulo (a) the 3 permanently-tooling-blocked cases (B03/B06/B07), (b) **L02** (the one genuine open — dev fix needed), and (c) the 12 documented PARTIAL residuals. Nothing else remains on ADM.

---

## Critical Findings (ranked)

1. **[MODERATE — dev follow-up] F-1: Payment-method REMOVE does not invalidate the `getPaymentMethod` module cache** (`subscription.ts` `_pmCache`). After a successful detach, `PaymentMethodsScreen` shows the removed card again on a same-session remount until app restart; other surfaces reading the cache (Manage Kids Club+ PaymentMethodSection, CartCheckout, TradeOffer) can show/offer a stale removed card. Fix: call `getPaymentMethod(true)` (or clear `_pmCache`) after a successful remove — mirror of the existing DT-81 attach-side fix.
2. **[BLOCKER for SUB-TC-N06 / DT120 Phase 2 — dev follow-up] F-2: `qa:r41-trial` fixture column bug** — `trial_started_at` (x2 in `scripts/qa/r41-trial-fixture.mjs`) vs staging `trial_start_date`. One-line fix; then re-run the approved N06 plan (5d → ≤7d pill → 14d → no-pill → reset).
3. **[LOW — design/copy] F-3:** Manage Kids Club+ expired status badge renders raw lowercase **"expired"** in a gray pill vs grace's friendly **"Grace Period"** (red) — inconsistent status-badge treatment on the same screen; recommend a friendly label ("Expired") and consistent semantic treatment.
4. **[LOW — R56 tracker] F-4:** ADM section header was stale (PASS 139/PARTIAL 16 vs actual 143/12). Corrected this round.
5. **[LOW — latent] F-5:** `LeaderboardScreen.tsx` still carries legacy `#4A7C59`/`#808080` styles (9 hits) — screen is only reachable via a nonexistent `leaderboard_rank_up` notification, so it's latent; sweep it in a future branding pass (R62c: dead/latent screens reported, not re-flagged as active).

## Locator / instrumentation notes
- Footer "Go Back" on the Manage Kids Club+ grace/expired sticky footer is not AX-exposed (no testID) — recommend `grace-footer-back-button` (BP-53).
- M01's `pm-loading-spinner` testID worked as documented.
- `qa:r41-trial` needs the column-name fix before it can ever run (see F-2).

## Friction vs. operating rules
- Stripe PaymentSheet native card entry: keyboard suppression (Cmd+K) + re-tap of "Set up" was needed (R70 embedded-form rule held); the sheet's AX coordinates for below-keyboard controls were logical, not rendered (§5.2), until the keyboard was dismissed.
- test-buyer Payment Methods R59 stale-empty on first visit (pre-existing; documented in QA Task 38).
- qa:ax-tree `(no coords)` on a filtered element → direct resource-file grep per QA Task 34 note (worked).

## Evidence (screenshots/)
- `A1-01` grace Manage Kids Club+ (both footer elements, no tab bar) · `A2-01` expired Manage Kids Club+ (both footer elements, no tab bar)
- `C1-01` Payment Methods (test-buyer, empty — R59) · `C1-02` return to Settings (M06 PASS)
- `D1-01` Stripe sheet · `D1-02` filled · `D1-03` attach-done stale-empty · `D1-04` "Payment Method Saved" alert · `D1-05` Saved Card · `D1-06` Remove confirm · `D1-07` "Removed" alert (M07 PASS)
- `E1-02` **M01 loading spinner + "Loading payment methods..." (live capture)** · `E2-02` N05 resolved free branch (source-confirmed spinner)

## Tracker updated (R52/R56)
`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`:
- SUB: M01/M06/M07/N05 → Completed PASS (4 rows added, source `qa-task39…`). Header PASS 72→76, Remaining (ACTIVE) 6→2 (G01 struck placeholder + N06). N06 note updated (fixture defect + one-line fix).
- ADM: section header R56-corrected PASS 139→143 / PARTIAL 16→12; QA Task 39 certification note added (all 160 accounted; L02 = sole genuine open; 12 PARTIAL residual).
- Roll-up table SUB row PASS 72→76 / Remaining 6→2.
- Per-guide totals after round: **ADM 143 PASS/12 PARTIAL/1 OPEN/0 DRIFT/1 SKIP/3 Rem · SUB 76 PASS/2 PARTIAL/3 OPEN/0 DRIFT/0 SKIP/15 RET/2 N/A/2 Rem (G01-struck + N06)**.

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 39 v2 — Batch A (DT125 footer fix re-verify: grace test-grace + expired test-expired on Manage Kids Club+), Batch B (SUB-TC-N06 trial-ending badge — attempted, BLOCKED on fixture), Batch C (SUB-TC-M06 Payment Methods Go Back — test-buyer), Batch D (SUB-TC-M07 detach/remove — qa-wallet disposable), Batch E (SUB-TC-M01 + N05 loading states), Batch F (QA Task 31c ADM closure certification — read-only doc audit). Staging `drntwgporzabmxdqykrp`; iPhone 17 Pro Max sim; mobile HEAD 0a104881.
**Design-System Compliance:** PASS with two minor observations — no color/token deviations on any rendered screen this run (Manage Kids Club+ grace/expired, Payment Methods, ContinueKidsClub free branch all on-brand per R62b source grep + R62c full-frame scans; grace/expired info boxes use canonical warning/info tokens). Observations: (1) expired status badge = raw lowercase "expired" in gray vs grace's friendly "Grace Period" (inconsistent status-badge copy/treatment); (2) `LeaderboardScreen` (latent) retains legacy `#4A7C59`/`#808080` — dead/latent-screen report, not an active deviation.
**Perceived Load-Time Verdict:** GOOD — no transition flagged ≥3s this round. The notable transition (cold app relaunch → Payment Methods) showed the expected brief loading state; the ContinueKidsClub trial-status fetch resolved faster than the capture window (sub-second).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Manage Kids Club+ (grace branch): "Re-subscribe to Kids Club+" pill + "Go Back" footer fully visible, no tab bar; grace warning box copy dated/friendly.
- CONFIRMED — Manage Kids Club+ (expired branch): same footer; expired info box friendly.
- DEVIATION (copy, LOW) — Manage Kids Club+ (expired branch) status badge reads raw lowercase "expired" in a gray pill (vs grace's friendly "Grace Period" red pill) — recommend a friendly mapped label + consistent semantic treatment.
- CONFIRMED — Payment Methods screen: empty state, "Payment Method Saved" success alert, Remove confirm, "Removed" alert, security banner copy all clear and friendly (no raw backend strings).
- CONFIRMED — ContinueKidsClub (free/Start Kids Club+ branch): on-brand (no legacy hex fill).
- CONFIRMED — Settings/Profile surfaces visited: standard copy, no deviations.
**Verdict Summary:** 6 PASS (Batch A ×2, M06, M07, M01, N05) / 1 BLOCKED (N06 — fixture defect) / 0 FAIL / 0 PARTIAL + Batch F = ADM closure CERTIFIED (read-only).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` updated (R52/R56): SUB-TC-M01/M06/M07/N05 flipped Remaining→Completed PASS (source `qa-task39-v2-footer-sub-adm-2026-09-06`, 2026-09-06); SUB-TC-N06 note updated (fixture defect `trial_started_at`→`trial_start_date` + one-line fix, remains ACTIVE/BLOCKED-on-fixture); ADM section header R56-corrected PASS 139→143 / PARTIAL 16→12 + QA Task 39 certification note appended; SUB header PASS 72→76 / Remaining (ACTIVE) 6→2; per-guide roll-up SUB row 72→76 PASS / Remaining 6→2. New per-guide totals: ADM 143/12/1/0/1/3 Rem · SUB 76/2/3/0/0/15/2 Rem (G01-struck + N06).
**Critical Findings:** 1. [MODERATE] F-1 — Payment-method REMOVE doesn't invalidate the `getPaymentMethod` module `_pmCache`; same-session remount shows the removed card until app restart (mirror of the DT-81 attach fix). 2. [BLOCKER] F-2 — `qa:r41-trial` fixture references nonexistent `trial_started_at` (staging = `trial_start_date`) in two places; blocks SUB-TC-N06 / DT120 Phase-2 staging run. 3. [LOW] F-3 — expired status badge copy "expired". 4. [LOW] F-4 — ADM tracker section header stale (fixed). 5. [LOW] F-5 — LeaderboardScreen latent legacy hexes.
**App State Left Behind:** App logged out at Landing (clean). test-trial persona: reset, 0 residue (DB-verified). qa-wallet (disposable used for M07): functional state clean (status active, `stripe_payment_method_id` null after the detach); **one residue flagged** — `stripe_customer_id` = `cus_VDA6aCp5fY8Uci` (test-mode Stripe customer created by the M07 attach; harmless, but qa-wallet's prior baseline was NULL — a dev/owner `UPDATE subscriptions SET stripe_customer_id=NULL WHERE user_id='a1234567-0000-0000-0000-0000000000f1'` (or Stripe customer deletion) restores pristine if a NULL-customer baseline is needed). No admin_config changes. test-buyer/test-grace/test-expired/test-free: logged in only, no fixture mutated (all standing states unchanged).
**Why It Matters:** This round (a) closes QA Task 38's C-1 on-device — the DT125 footer fix genuinely works on BOTH grace and expired branches (tab pill gone, both footer elements visible, Go Back functional); (b) closes 4 of SUB's final 5 active cases (M01/M06/M07/N05), leaving exactly ONE genuinely-active SUB case (N06), which is blocked by a real, precisely-diagnosed fixture-script bug (one-line fix); (c) certifies ADM's 160-case board as fully accounted — every case has a verdict or a named permanent exception — with exactly ONE genuine open (L02, missing `category_sp_analytics` table) and corrects a stale tracker header; (d) surfaces a new moderate payment-cache defect (remove doesn't clear the client PM cache).
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task39-v2-footer-sub-adm-2026-09-06/` (screenshots A1/A2/C1/D1/E1/E2). Footer fix repro: `qa-login-as?persona=test-grace` (or test-expired) → `manage-kids-club` → both footer elements visible, no tab bar. M07 F-1 repro: on a card-less disposable (qa-wallet), Settings→Payment Methods→Add (4242)→Remove→confirm→**immediately navigate away and back** → the removed card reappears until app relaunch. N06 F-2 repro: `npm run qa:r41-trial -- ensure` → observe the `trial_started_at` upsert error; fix = `trial_started_at → trial_start_date` in `scripts/qa/r41-trial-fixture.mjs` (2 spots). ADM certification: see Batch F section + tracker ADM section.
**Known Gaps / Not Tested:** (1) SUB-TC-N06 not executed — blocked on the `qa:r41-trial` fixture column bug (app logic source-audited correct). (2) N05 loading spinner not live-captured (source-confirmed only — transient). (3) The M07 unauthenticated-remove leg ("You must be logged in to manage payment methods.") not driven (server-guard path). (4) The expired-branch footer "Go Back" not separately tapped (code-identical to the grace branch where it was functionally verified). (5) ADM B03/B06/B07 + L02 + 12 PARTIAL residuals remain (B03/B06/B07 = permanent tooling exceptions, L02 = dev fix, PARTIALs = documented fixture/driver reasons) — out of this session's scope or requiring dev action. (6) Batch F was a read-only doc audit — no execution against the live admin portal.
**What Needs To Be Fixed Next:**
1. Fix F-2 (blocks SUB-TC-N06 / DT120 Phase 2): in `scripts/qa/r41-trial-fixture.mjs`, replace `trial_started_at` with `trial_start_date` in the subscriptions upsert (~L213) AND the `printStatus` select (~L258); then re-run the approved N06 plan (ensure 5d → ≤7d pill on-device → ensure 14d → no-pill → reset).
2. Fix F-1 (MODERATE): after a successful `detach-payment-method` in `PaymentMethodsScreen.handleRemovePaymentMethod`, invalidate the payment-method cache (`getPaymentMethod(true)` or clear `_pmCache`) so a same-session remount shows the true empty state; verify other `getPaymentMethod()` consumers.
3. Fix L02 (ADM's sole genuine open): create/back `public.category_sp_analytics` (or re-point the query) so the SP Analytics data leg + CSV export render; re-verify on-device/admin.
4. Instrument the Manage Kids Club+ footer "Go Back" with a `testID` (`grace-footer-back-button`) for AX-drivability.
5. Normalize the expired status badge copy ("Expired" friendly label + consistent semantic treatment with the grace badge).
6. (Optional, low) Sweep `LeaderboardScreen.tsx` legacy `#4A7C59`/`#808080` in a future branding pass (latent screen).
**UX Enhancement Ideas (optional, not defects):** (1) On the Manage Kids Club+ grace/expired sticky footer, the "Go Back" link sits directly under the primary CTA with no testID — consider keeping the footer's two actions visually distinct (primary pill + text link already) but adding the standard 44pt touch target + hitSlop so it's reliably tappable. (2) The ContinueKidsClub trial badge is brief by design — consider whether a persistent (non-transient) "trial ends {date}" line under the CTA would reduce surprise renewals (only if it fits the DT-119 design intent).
**Suggested Next Session:** A short follow-up that (a) re-runs SUB-TC-N06 on-device once the `qa:r41-trial` one-line fixture fix lands (Batch B plan), and (b) re-verifies ADM-TC-L02 after the `category_sp_analytics` table fix. If both close, the project board reduces to exactly: ADM's 3 tooling-blocked cases (B03/B06/B07) + TRD/AUTH/ACC's untouched backlog (both explicitly out of scope) — nothing else.
**Suggested to Improve Agent Rules:** Recommend codifying the F-1 class as a standing rule extension: after any destructive backend mutation (remove/detach/delete) that a client module caches, verify the cache is invalidated — the attach side already has this (DT-81); the remove side did not. A one-line R-rule ("check the mirror of the cache-bypass fix on the destructive path too") would have caught F-1 before the on-device stale-remount observation. (Otherwise R63–R76 + the §8.3 template worked as designed.)
