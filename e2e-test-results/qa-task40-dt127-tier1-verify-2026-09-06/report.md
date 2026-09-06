# QA Task 40 — DEV-TASK-127 Tier 1 Re-Verification (closes SUB + ADM)

- **Date:** 2026-09-06 · **Device:** iPhone 17 Pro Max simulator (iOS 26.1, UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`)
- **Repo HEAD:** `9db0b742` (includes the DEV-TASK-127 code commit `708d01c7` + the flow-registry consolidation commit; working tree clean; not re-pushed — per convention QA reviews/pushes)
- **Admin portal:** `http://localhost:3001` live (samer session) · **Staging:** `drntwgporzabmxdqykrp`
- **Exact tool-call count (mined, R71):** **152 tool executions / 134 messages** via `qa:mine-call-ledger` — a short, single-purpose round as intended (vs QA Task 38's 234 / QA Task 37's 487).

## Verdict roll-up

| TC-ID / item | Surface | Verdict | Top finding |
|---|---|---|---|
| SUB-TC-N06 (≤7d leg) | mobile | ✅ PASS | urgency badge "5 days left in trial" on-brand (warning #FFF3E0/#FFA726), 0 legacy hex |
| SUB-TC-N06 (>7d leg) | mobile | ✅ PASS | NO countdown badge at 14d; no "free days" pill for a trial member |
| Batch D item 3 (net-new trial-end-line) | mobile | ✅ PASS | "Trial ends September 11/20, 2026" — correct DB date binding on BOTH branches |
| F-1 payment-cache fix re-verify | mobile | ✅ PASS | remove → same-session remount → TRUE empty state (no stale card) |
| ADM-TC-L02 independent verification | admin | ✅ PASS | dashboard renders, 90d = 7 categories, CSV export works, R54 DB-reconciles, category click routes |
| Batch D item 1 grace-footer-back-button | mobile | ✅ PASS | AX-exposed, 44pt target, drivable (single tap → back); no tab-bar occlusion |
| Batch D item 2 Expired badge | mobile | ✅ PASS | label "Expired" + #E85D75 pill (0.41% full-frame) — design flag raised |
| Batch E Leaderboard hex swaps | mobile (latent) | ✅ PASS (source-audited) | 9 swaps canonical; app-wide R62b grep = 0 legacy hexes |

**Totals: 8 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.**

---

## Batch A — SUB-TC-N06 (closes SUB's last real open case)

Guide: `MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (SUB-TC-N06). Pre-read confirmed the ≤7d/`>7d` branch logic in `ContinueKidsClubScreen.tsx` (urgency badge when `trial && daysRemaining ≤ 7 && > 0`; `showDefaultTrialBadge = !isTrialSubscription`) and DT-127 item 7 (`trial-end-line` + `formatTrialEndDate`).

- **DB precondition (R63):** test-trial (`a1234567-…015`) present at `status='trial'`, `trial_end_date 2026-09-11`, **5 days remaining** (as left by DT-127 phase 2).
- Clean launch → `qa-login-as?persona=test-trial` (Home) → `continue-kids-club` deep link.
- **≤7d leg:** title "Continue Kids Club+"; **urgency badge "5 days left in trial"** (StaticText, y≈169); price $5.99; CTA `subscribe-cta-button` ("Continue on the web"); **no** "30 free days • no charge today" pill (correct — `showDefaultTrialBadge=false` for trial). **`trial-end-line` "Trial ends September 11, 2026"** renders under the CTA — matches DB `trial_end_date` exactly.
  - Design-system check: badge-scan on the ≤7d screenshot — warning-orange `#FFA726` present (0.08%, text pixels), legacy `#4A7C59` = **0 px**. Theme tokens confirmed `warning.100 #FFF3E0` / `warning.500 #FFA726` (canonical). Evidence: `screenshots/SUB-N06-test-trial-5d-badge.png`.
- **>7d leg:** `qa:r41-trial -- ensure --days-remaining 14` (owner-directed fixture write) → DB `trial_end_date 2026-09-20`, 14 days (read-back verified). The first re-open rendered a stale NON-trial branch — diagnosed as R59-class stale state after the fixture's password re-sign mid-flow invalidated the app session (not an app defect); after a **clean relaunch + fresh fetch**, the >7d branch rendered correctly: "Continue Kids Club+", **NO urgency badge** (the y112→y181 band between title and "Keep Your Premium Benefits" is empty), no free-days pill, `trial-end-line` **"Trial ends September 20, 2026"** (date follows the updated DB row), price $5.99. Evidence: `screenshots/SUB-N06-test-trial-14d-no-badge.png`.
- **Cleanup:** `qa:r41-trial -- reset` → 0 residue; DB-verified auth user 0 + subscription 0.

**SUB-TC-N06 = PASS (both branches).** SUB's last genuinely-active remaining case is closed; SUB genuinely-active remaining = 0.

## Batch B — F-1 Payment Cache Fix Re-Verify

Guide/context: DT-127 item 2 — `subscription.ts` now exports `invalidatePaymentMethodCache()` (clears `_pmCache` + `_pmPromise`), and `PaymentMethodsScreen.handleRemovePaymentMethod` calls it after a successful detach. This is the exact defect QA Task 39 F-1 found (same-session remount showed the removed card). Persona: **test-free** (QA buyer with a saved MASTERCARD 4444; secondary persona; fully restorable).

- Navigated Profile → Settings → `settings-payment-methods-button` → Payment Methods.
- **Before:** saved card **MASTERCARD •••• 4444** (exp 08/2027) rendered (`pm-saved-card`); the module-level PM cache is now populated in-session (the precondition the old bug required). Evidence: `screenshots/B2-pm-card-present-4444.png`.
- **Remove:** `pm-remove-button` → in-app GlobalAlertProvider confirm ("Remove Payment Method" / Cancel / Remove — AX-exposed `global-alert-button-1`) → **detach-payment-method EF → `invalidatePaymentMethodCache()` + `setPaymentMethod(null)`** → "Removed / Your payment method has been removed." → empty state "No Payment Method" (`pm-empty-state`, `pm-add-button`) rendered. Evidence: `screenshots/B2-pm-empty-after-remove.png`.
- **THE F-1 ASSERTION — same-session remount:** navigated back to Settings and re-opened Payment Methods (fresh mount, same app process — the cache would have returned the removed card pre-fix). **True empty state shown — no stale reappearing card.** `invalidatePaymentMethodCache()` works.
- **Restore (zero residue):** `qa:ensure-cards --persona test-free` re-attached MASTERCARD 4444 (`pm_1UCkX54I6kCJlvXo…`) + persisted to `subscriptions.stripe_payment_method_id`; DB-verified.

**F-1 = PASS** (fix confirmed on-device; persona restored to canonical card state).

## Batch C — ADM-TC-L02 Independent Verification

Guide: `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` (ADM-TC-L02). Dev's own read-only check (RPC present, 7 categories/90d) was **independently confirmed on the live admin portal** (:3001, samer session):

- Login OK → `/sp-analytics` loads **SP Analytics Dashboard**: per-category Velocity / Gap % / Avg Cash per trade + anomaly flags ("hoarding", "spending spike", "Low Velocity"), summary card + table (CATEGORY | VELOCITY | GAP % | AVG CASH / TRADE | ANOMALIES), **Export CSV** button. Evidence: `screenshots/ADM-L02-sp-analytics-30d.png`.
- **Date-range switch:** Last 7 / 30 / 90 Days all present and switchable. 90-day meta = **"Last 90 days · 7 categories · 6 flagged"** — matches dev's RPC check exactly. All 7 categories render: Sports, Books, Electronics, Games, Toys, Art & Crafts, Clothing. Evidence: `screenshots/ADM-L02-sp-analytics-90d.png`. **Doc-drift:** the guide's "7/30/90/**365** days" overstates — `DateRangePicker` implements only 7/30/90 (ADMIN-V3-006 component comment "7, 30, or 90 day buttons"); not an app defect.
- **Category click:** clicking the Books row navigates to `/categories?edit=4b400d90-…&tab=sp-config` (documented routing). Evidence: `screenshots/ADM-L02-category-sp-config-route.png`.
- **CSV export:** client-side blob download (filename `sp-analytics-90days-*.csv`); captured the generated content — headers `Category ID,Category Name,Velocity,Gap %,Avg Cash Per Trade,Anomaly Flags` + **7 category rows** (Sports, Books, Electronics, Games, Toys, Art & Crafts, Clothing) — all 6 documented columns present.
- **R54 DB reconciliation:** ran `get_category_sp_analytics(now() - interval '90 days', now())` — **every displayed metric reconciles digit-for-digit** (e.g. Sports 2.44/59.1/29.33, Books 2.44/59.0/160.88, Electronics 1.94/48.5/38.12 — RPC = CSV = UI). RPC return shape is `(category_id, category_name, velocity, gap_percent, avg_cash_per_trade)`; anomaly flags are client-derived from thresholds.

**ADM-TC-L02 = PASS (independent live-admin confirmation).** ADM stands at 144 PASS / 0 OPEN (modulo the 3 permanent ADM-R3 tooling exceptions B03/B06/B07).

## Batch D — Footer, Badge, and New Trial-End Line

- **D1 — grace-footer-back-button (grace branch):** `qa-login-as?persona=test-grace` → `manage-kids-club`. Manage Kids Club+ grace branch renders Status badge "Grace Period" + warning box ("Your Swap Points are frozen. Re-subscribe before November 2, 2026…") + sticky footer with `resubscribe-kids-club-button` and **`grace-footer-back-button` AX-exposed at (16,877,408,44)** — **44pt-tall touch target (≥44pt rule met)**, accessible/role/label per BP-53. **No floating tab bar on this screen** (`ManageKidsClub` is now in `TAB_BAR_HIDDEN_ROUTES`) — the DT-124 item-9 "Go Back occluded by tab pill" finding is resolved. Single tap at the footer's center navigated back to Home — **drivable and reliable**. Evidence: `screenshots/D1-grace-footer-back.png`.
- **D2 — Expired badge:** `qa-login-as?persona=test-expired` → lands on the SubscriptionExpired gate → warm `manage-kids-club` deep link → Manage Kids Club+ **expired branch**: status badge reads **"Expired"** (capitalized — DT-127 item 4 label fix) + "Your subscription has expired / Re-subscribe to restore…" + same sticky footer. Badge pill **verified `#E85D75`** — full-frame badge-scan 15,616 px (0.41%, a real fill, far above the ~0.01–0.06% AA baseline). Evidence: `screenshots/D2-expired-badge-E85D75.png`.
  - **DESIGN FLAG (task-directed):** this reverses the prior DT-119 neutral-gray decision (`badge_expired` was `#6B6B6B`). Source comment confirms "Revert to a neutral fill if a terminal/inactive reading is preferred (one-line change)". Flag to design/product: **is the error-red (#E85D75) Expired badge actually wanted**, or should a terminal/inactive state read neutral-gray? Dev noted it is a one-line revert if not.
- **D3 — trial-end-line (net-new surface, first-look QA):** covered on BOTH trial branches in Batch A. Copy "Trial ends {month day, year}" is clear, plain-English, correctly placed immediately under the primary CTA (`trial-end-line` at y≈812/767, semantic secondary text, margin mt4/mb12), on-brand styling (`#6B6B6B` secondary text on `#FAFAFA`), and **date binding correct** — "September 11, 2026" at 5d and "September 20, 2026" at 14d both match the DB `trial_end_date`. Non-transient (always shown for trial users, per DT-127 item 7) — good UX (parents always see when the free trial ends, reducing surprise renewals). **PASS.**

## Batch E — LeaderboardScreen hex swaps (low priority, non-blocking)

`LeaderboardScreen` is a **latent screen** (no in-app nav entry; `Leaderboard` intentionally NOT in the linking config per the MSG B05 product decision), so no on-device visual is possible. Source-audited (R62b/C): the file uses only canonical colors — `#5DBB8E` (primary), `#6B6B6B` (secondary), `#1A1A1A` (primary text) — and the **app-wide R62b grep (`#4A7C59|#4D4D4D|#808080`) returns 0 hits across `p2p-kids-marketplace/src`**. The 9 swaps are correct and complete. **PASS (source-audited, latent screen).**

---

## Cross-cutting notes

- **Design & copy:** every screen/dialog visited this run was on the canonical palette (warning pill `#FFF3E0`/`#FFA726`; error pill `#E85D75`; primary green; neutral text tiers). No raw machine/system strings surfaced on any user-facing surface (R58 clean). All copy is parent-appropriate.
- **Load time (perceived, wall-clock ± poll precision):** deep-link → ContinueKidsClub / ManageKidsClub renders appeared within the first poll (~1–2s) after every navigation; the profile deep-link + payment flows were all sub-3s. **Verdict GOOD** — nothing flagged ≥3s.
- **R59 exercise:** the mid-Batch-A stale non-trial render after the fixture's password re-sign was exactly the R59 class (screen stale until a fresh fetch after a backend/session change) — resolved by a clean relaunch, not an app defect.

## App State Left Behind

- `test-trial`: **fully deleted** (BP-70 reset) — auth user + subscription 0 (DB-verified). Left unprovisioned (dev re-runs `qa:r41-trial -- ensure` for any future trial-branch need).
- `test-free`: card removed during the F-1 cycle then **restored** to MASTERCARD 4444 (`pm_1UCkX54I6kCJlvXoi99P0PFc`, DB-verified).
- `test-grace` / `test-expired`: untouched (view-only), intact at `grace` / `expired` status.
- Mobile app: logged out via `qa-logout` (Landing). Admin portal: left logged in at `/categories?edit=…&tab=sp-config` (no state mutated).
- No admin_config / category / node changes were made this round. No Stripe objects created beyond the restored test-free PM (test mode).

## Suggested follow-ups (dev / design — separate tasks, not applied)

1. **DESIGN DECISION (Batch D2):** confirm whether the expired-branch badge should read error-red `#E85D75` (current DT-127) or revert to neutral-gray (`badge_expired` — one-line). Currently the same error red as the grace branch; a "terminal/inactive" reading may warrant a neutral treatment.
2. **Doc-drift:** ADM-TC-L02 guide step lists "7/30/90/**365** days" — the dashboard offers 7/30/90 only (correct the guide).
3. **R77 recommendation (owner-requested):** add a playbook rule that **destructive-path cache-invalidation checks** (remove/delete actions must invalidate any shared module cache — the F-1 class) be verified by a same-session remount assertion as a standing re-verify pattern.

## 📋 QA Session Handoff

**Test Scope:** QA Task 40 — DEV-TASK-127 Tier-1 re-verification across Batch A (SUB-TC-N06 trial urgency ≤7d/>7d), Batch B (F-1 payment-cache fix re-verify), Batch C (ADM-TC-L02 SP Analytics independent live-admin verification), Batch D (grace-footer-back-button drivability/target; expired-branch "Expired" #E85D75 badge; net-new `trial-end-line` first-look), Batch E (LeaderboardScreen 9 hex swaps, source audit), cleanup.
**Design-System Compliance:** PASS — every rendered screen/pill on the canonical Pass-It-Up palette (urgency pill #FFF3E0/#FFA726, error #E85D75, primary #5DBB8E, neutral text tiers #1A1A1A/#6B6B6B/#999999); R62b app-wide grep = 0 legacy hexes (#4A7C59/#4D4D4D/#808080); no raw machine/system copy on any user-facing surface (R58). One design question flagged (not a deviation): the Expired badge's error-red vs neutral-gray intent.
**Perceived Load-Time Verdict:** GOOD — all observed transitions (deep-link → ContinueKidsClub / ManageKidsClub, Settings → Payment Methods, admin route changes) rendered within ~1–2s (first-poll appearance, ± poll precision); nothing ≥3s flagged.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ContinueKidsClub ≤7d branch (test-trial): "Continue Kids Club+" title, warning urgency pill "5 days left in trial", no free-days pill for a trial member — copy/layout/colors correct.
- CONFIRMED — ContinueKidsClub >7d branch (test-trial, 14d): no countdown badge, plain upsell, $5.99 — correct.
- CONFIRMED — ContinueKidsClub `trial-end-line` (net-new): "Trial ends September 11/20, 2026" under the CTA — clear copy, correct placement, on-brand secondary-text styling, correct DB date binding on both branches.
- CONFIRMED — Manage Kids Club+ grace branch (test-grace): "Grace Period" badge + warning box + sticky footer (Re-subscribe + Go Back) — no tab-bar occlusion, canonical error/warning tokens.
- CONFIRMED — Manage Kids Club+ expired branch (test-expired): "Expired" badge (#E85D75) + expired info box + sticky footer — on-brand.
- CONFIRMED — Payment Methods screen (test-free): saved-card and empty-state surfaces — canonical styling; remove-confirm + "Removed" alerts via branded GlobalAlertProvider.
- CONFIRMED — Admin /sp-analytics (samer session): dashboard + table + CSV export — clean layout; category routing to the SP Config edit modal correct.
- CONFIRMED — SubscriptionExpired gate (test-expired): "Your Kids Club+ plan ended on July 25, 2026" dated copy — correct.
**Verdict Summary:** 8 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED.
**Coverage Tracker Updated:** SUB-TC-N06 flipped Remaining-ACTIVE → Completed **✅ PASS** (2026-09-06, source `qa-task40-dt127-tier1-verify-2026-09-06`); SUB roll-up + section header reconciled PASS 76→**77**, Remaining (ACTIVE) 2→**1** (struck G01 placeholder only; genuinely-active remaining = 0) — §1 roll-up, section header, ACTIVE-list header/body all updated atomically (R56). ADM-TC-L02: no count flip (already ✅ PASS 144 / OPEN 0 per DT-127); its row Notes + evidence appended with this round's independent live-admin verification. New per-guide totals: SUB 77 PASS / 2 PARTIAL / 3 OPEN / 15 RETIRED / 2 N/A / 1 ACTIVE(bookkeeping) / 100 total; ADM 144 PASS / 12 PARTIAL / 0 OPEN / 3 Remaining (permanent B03/B06/B07 exceptions) / 160 canonical.
**Critical Findings:** (1) DESIGN QUESTION — Expired status badge now error-red #E85D75 (DT-127 reversal of DT-119 neutral-gray); confirm intent with design/product (one-line revert available). (2) None — no app defects found; all six DT-127 delivered items verified working on-device/live.
**App State Left Behind:** test-trial fully deleted (0 residue, DB-verified); test-free card restored (MASTERCARD 4444 `pm_1UCkX54…`); test-grace/test-expired intact; mobile app logged out (Landing); admin portal left logged-in (no mutations); no config/category/node changes.
**Why It Matters:** This round independently confirms every DEV-TASK-127 delivered item on-device/live and closes SUB's last genuinely-open case (SUB-TC-N06) plus the ADM L02 independent-confirmation loop. F-1 (stale payment-method cache after remove) is proven fixed. SUB's last real open case and ADM's independent-verification hold are both closed, so the project board reduces to exactly two things: the 3 permanently tooling-blocked ADM cases (B03/B06/B07) and the 47-case TRD/AUTH/ACC backlog.
**How to Verify/Reproduce:** Run evidence + screenshots in `e2e-test-results/qa-task40-dt127-tier1-verify-2026-09-06/` (`screenshots/SUB-N06-*`, `B2-pm-*`, `ADM-L02-*`, `D1-grace-footer-back.png`, `D2-expired-badge-E85D75.png`). N06: `qa:r41-trial -- ensure --days-remaining 5|14` → `qa-login-as?persona=test-trial` → `continue-kids-club` (badge at ≤7d, none at >7d, `trial-end-line` always). F-1: Settings → Payment Methods → remove card → remount → empty. L02: admin `/sp-analytics` → 90d → 7 categories → Export CSV → compare to `get_category_sp_analytics(now()-90d, now())`.
**Known Gaps / Not Tested:** Batch E (LeaderboardScreen) is source-audited only — the screen is latent (no in-app nav, no deep link) so no on-device visual is possible (matches the MSG B05 product decision). F-1's UI "attach" leg (native PaymentSheet) was not driven in-session — the fix assertion (remove → same-session remount → empty) was verified on test-free's pre-existing card, which exercises the identical cache-population + invalidation path.
**What Needs To Be Fixed Next:** (1) Design/product decision on the Expired badge color (#E85D75 vs neutral-gray) — one-line revert in `ManageKidsClubScreen.tsx` `badge_expired` if neutral is wanted. (2) Doc-drift: ADM guide's L02 step cites a "365 days" range the dashboard does not implement (correct to 7/30/90). (3) Add playbook rule R77 (destructive-path cache-invalidation re-verify — same-session remount assertion after any remove/delete that touches a shared module cache).
**UX Enhancement Ideas (optional, not defects):** On ContinueKidsClub, the non-transient `trial-end-line` is a genuine improvement (parents always see when the trial ends) — no further ideas this run beyond what was observed.
**Suggested Next Session:** The next scoping decision is the **47-case TRD/AUTH/ACC backlog** — do NOT start it piecemeal; produce an explicit per-case scope/plan first (R40) covering the full 47.
**Suggested to Improve Agent Rules:** Add R77: any destructive-path action (remove/delete/detach that clears shared module or client caches) is re-verified by a **same-session remount** assertion (navigate away → back → confirm the true post-mutation state, not the stale cached one) — the F-1 defect class this round proved fixed.
