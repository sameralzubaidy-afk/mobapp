# QA Task 35 — Dev Task 119 Live Verification (Every Branch, R62a) + Remaining SUB Follow-Ups

- **Date:** 2026-09-05 (local) / run folder `e2e-test-results/qa-task35-dt119-branches-sub-2026-09-05/`
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1), dev build via Metro `:8081`
- **Personas:** qa-payout-seller (DT118 fixture, ACTIVE sub), test-free, test-grace, test-expired, test-seller (grace_period, 25 payouts), test-buyer (active)
- **Under test:** DT-119 commit `3a98afc9` (HEAD) — ContinueKidsClub branding fix + payout follow-ups + UX. Working tree clean; app loaded the fresh Metro bundle (DT-119 changes verified live).
- **Method:** `mobile-mcp` (AX tree + screenshots + OCR/badge-scan + DB read-back per R24/R11). Source pre-reads per R18. Execution-only — no code changed.

---

## THE ROUND'S QUESTION — answered

> **Does R62a (audit EVERY rendered branch of a multi-state screen) catch the branch-drift that QA Task 34 missed — and are all DT-119 fixes live?**
>
> **YES — with one documented fixture-gap.** Every on-device-reachable branch of ContinueKidsClub (active / free / grace / expired / grace_period) and every reachable state of the 7 other fixed screens was rendered and audited. **Zero off-brand `#4A7C59` remains on any reachable branch** — the exact D1 defect class that slipped through QA Task 34's single-branch check is confirmed fixed on the branch that was missed (the non-active upsell branch). The only branch that could not be rendered on-device is the **trial-with-≤7-days** state (no standing `trial`-status persona exists on staging — a provisioning gap, not a code issue); its styles were source-audited canonical. The payout follow-ups (requires_action CTA, friendly unverified copy, gross/net footnotes, pending-color, Load More) are all verified live.

---

## Verdict roll-up

| Batch / leg | Verdict | Summary |
|---|---|---|
| **A** — ContinueKidsClub active branch | ✅ PASS | Kids Club+ Active + "✓ You're all set" (#E8F5F0/#5DBB8E) + Manage btn #5DBB8E — on-brand |
| **A** — ContinueKidsClub free/grace/expired/grace_period (upsell) | ✅ PASS | **D1 FIXED**: positive "30 free days • no charge today" pill (#E8F5F0 bg / #4DAA7A text), pricing card + "Join Kids Club+ on the web" CTA #5DBB8E, **0% #4A7C59** full-frame |
| **A** — ContinueKidsClub trial ≤7d / trial >7d | 🟡 PARTIAL (source-audited) | urgency pill source-canonical (#FFF3E0/#FFA726 via theme warning tokens); on-device render needs a trial persona (fixture gap; guide `test-trial@` unprovisioned) |
| **B** — ManageKidsClub active + expired | ✅ PASS | active (Status Active/Next Billing) + expired badge fill #6B6B6B (DT-119) verified; free state = no-active-sub early-return (badge_free not exercised — dead for free users) |
| **B** — SubscriptionStatusScreen (expired) | ✅ PASS | EXPIRED status text #999999 on-device (DT-119) via staged `/subscription/status` notification |
| **B** — PaymentMethodsScreen | ✅ PASS | empty state body text #6B6B6B + #5DBB8E Add Payment primary; no legacy hex |
| **B** — TransactionHistoryScreen empty + populated | ✅ PASS | empty text #6B6B6B; populated dates #999999; FAILED + reason caption renders |
| **B** — LinkedAccountsScreen | ✅ PASS | icons/buttons #5DBB8E; no legacy hex |
| **B** — TradeTimelineScreen (completed + cancelled) | ✅ PASS | both states clean full-frame (no legacy); bundleItemPrice #6B6B6B source-verified (expandable item list only renders for in-progress bundles — no such fixture on test-seller) |
| **B** — PayoutSettings pending color | ✅ PASS | history "Pending" + clock icon #FFA726 (was #F59E0B); 0% SP-gold |
| **C** — requires_action → "Set Up Payout Method" | ✅ PASS | **G06 gap CLOSED** — CTA on live history card (`history-action-248fdfc3…`) → opens AddPayoutMethodModal (Stripe Connect/bank/PayPal/Venmo) → Cancel clean |
| **D** — Friendly unverified-method copy | ✅ PASS | reject alert = "Your payout method isn't verified yet. Please finish verifying it before withdrawing." (not raw RPC string); 0 payout rows, balance unchanged (DB) |
| **E** — Hero + history gross/net footnotes | ✅ PASS | `balance-fee-note` + `payout-history-fee-note` on-device (test-seller + qa-payout-seller); gross-vs-net distinction now clear |
| **F** — F08/G10 Load More pagination | ✅ PASS | test-seller (25 payouts = 5 pages): 5→10→15 via 2 clean taps, no occlusion |
| **F** — D05 independent re-drive | 🟡 NOT DRIVEN (documented) | requires a dedicated R41-class real-Stripe disposable session; wallet-unfreeze step remains proven by DT-118's fresh-disposable live-verify (bb862192) |
| **F** — G01 real Connect onboarding | 🟡 NOT DRIVEN | pending real-account provisioning (per brief's allowance) |

**Roll-up: 13 PASS · 2 PARTIAL/source-audited-or-deferred (trial branch, D05/G01 fixture-gated) · 0 FAIL · 0 BLOCKED**

---

## Execution trace (condensed — full tool-call sequence in the session)

### Batch A — ContinueKidsClub, every reachable state (R62a)
Source pre-read (`ContinueKidsClubScreen.tsx` + `trialConversion.ts` + `theme/colors.ts`): branches = `active` (`kids-club-active-screen`) vs upsell (`kids-club-overview-screen`); within upsell, `trial` renders "Continue Kids Club+" + (≤7d) the warning urgency pill vs non-trial (free/grace/expired) the positive green-tint free-days pill. Urgency pill = `theme.colors.warning[100/500]` (#FFF3E0/#FFA726); free-days pill = `theme.colors.primary[100/600]` (#E8F5F0/#4DAA7A). No standing `trial` persona exists (DB query: 227 trial rows are all real-user legacy; guide's `test-trial@` actor unprovisioned) — see Known Gaps.

1. **active** (qa-payout-seller): deep link → Kids Club+ Active branch. Pill "✓ You're all set" = 57.9% #E8F5F0 + 8.8% #5DBB8E; Manage Kids Club+ button = 86.7% #5DBB8E + white text. Full-frame: 0 #4A7C59. **PASS.**
2. **free** (test-free): deep link → upsell + **"30 free days • no charge today"** positive pill (79.1% #E8F5F0 + 7.1% #4DAA7A); pricing card + CTA band 84.6% #5DBB8E, **0% #4A7C59** (D1 legacy green GONE). Full-frame: 0/0.01%/0.04% (#4A7C59/#4D4D4D/#808080) — at AA baseline. **PASS.**
3. **grace** (test-grace, status `grace`): upsell + positive pill present. **PASS.**
4. **expired** (test-expired): deep link bypasses the SubscriptionExpired gate → upsell + positive pill present. **PASS.**
5. **grace_period** (test-seller): upsell + positive pill present. **PASS.**

### Batch B — the 7 other fixed screens (reachable states)
- **ManageKidsClub active** (qa-payout-seller, via continue-active-manage-btn): Status Active / Next Billing Oct 5 2026 / 30 days / Auto-Renew / Billing History. Full-frame clean. **PASS.**
- **ManageKidsClub expired** (test-expired deep link): status badge "expired" fill #6B6B6B (1.06% #6B6B6B, 0.05% #808080 AA) + "Your subscription has expired" info box + Re-subscribe copy. **DT-119 badge_expired fix verified.** **PASS.** *Free state (test-free) renders the "You don't have an active Kids Club+ subscription." early-return with no badge → `badge_free` is not exercised for free users (dead branch note, not a defect).*
- **SubscriptionStatus** (test-expired): reached via staged `/subscription/status` notification (r41-sub notif-sub-status; removed after). EXPIRED status text renders #999999 (0.84%; #808080 0.05% AA). **DT-119 statusColor fix verified.** **PASS.**
- **PaymentMethods** (test-buyer, Settings → Manage Payment Methods): empty state — body/subtitle/security text #6B6B6B (1.04%), Add Payment Method primary #5DBB8E (4.19%), no legacy. **PASS.**
- **TransactionHistory empty** (test-seller, `billing-history`): "No billing history yet." #6B6B6B (0.18%), #808080 0.01%. **PASS.**
- **TransactionHistory populated** (test-buyer): 4 rows (1 FAILED + reason caption "Your payment was declined…" + SUCCEEDED); date captions #999999 (0.14%); FAILED badge renders. **PASS.**
- **LinkedAccounts** (test-seller, `linked-accounts`): email/password/social cards; icons + Link buttons #5DBB8E (1.45%), no legacy. **PASS.**
- **TradeTimeline completed + cancelled** (test-seller, `/trade/<id>` deep links): both render clean (0% #4A7C59, grays at AA baseline). `bundleItemPrice` #6B6B6B source-verified; the expandable "Bundle offer · N items" item list (where it renders) only appears for **in-progress** bundles (`bundleSize` counts only pending/in_progress siblings) — no in-progress bundle fixture exists on test-seller, so that leg is source-verified (shared style). **PASS** (in-progress/disputed render legs documented as not-fixture-available, not separately rendered).
- **PayoutSettings pending color** (test-seller): history-row "Pending" status text = #FFA726 (8.3% in band), **0% #F59E0B**. **DT-119 money-pending color fix verified.** **PASS.**

### Batch C — requires_action → "Set Up Payout Method"
`qa:payout-fixture ensure` (clean) + `balance 500` + `stage-trade --amount 2000` (no verified method) → genuine `requires_action` payout `248fdfc3` (gross 2000 / fee 0 / net 2000 / provider null). Remount Payout Settings → history row "$20.00 / **Action Required**" + **"Set Up Payout Method"** CTA (`history-action-248fdfc3-…`, #5DBB8E pill) → tap → **AddPayoutMethodModal** opens (title + Stripe Connect "Bank deposits via Stripe" / PayPal / Venmo options + Add Method) → Cancel dismisses cleanly. **This is the exact G06 PARTIAL from QA Task 34, now fixed by DT-119 item 2.** **PASS.**

### Batch D — friendly unverified-method copy
`methods --scenario single-unverified` (unverified auto-primary, "Onboarding required") + remount → Withdraw Now (balance $20.00) → WithdrawModal (fee -$0.30, You'll Receive $19.70, method Stripe (acct_****_unv)) → Confirm → alert:
- Title "Withdrawal Failed"
- Body **"Your payout method isn't verified yet. Please finish verifying it before withdrawing."** (DT-119 item 4 — the friendly copy; NOT the raw "Primary payout method is not verified").
DB: 0 processing payout rows, available balance unchanged (2000). **PASS.**

### Batch E — gross/net footnotes
Hero footnote `balance-fee-note`: **"Balance amounts are before payout provider fees — deducted at payout."** — present under Withdraw Now on both test-seller and qa-payout-seller. History note `payout-history-fee-note`: **"Amounts below are what you receive after your payout provider's fee — Pass It Up charges no withdrawal fee."** — present above history rows on both. Together they make the gross (hero) vs net (history rows, + per-row "Stripe fee: $X" caption) distinction clear. **PASS.** *LOW edge note:* a `requires_action` payout with no method has no computable fee → row shows gross=net ($20.00); consistent (fee can't exist without a method) but the note's "net" promise is technically only meaningful once a method exists.

### Batch F — SUB follow-ups
- **F08/G10** (test-seller, 25 payouts): Load More (`load-more-button`) tapped at y787 (clear of the pill band y848+) → rows 5→10, then second tap → 15. Clean pagination, no occlusion, testID-functional. DB total = 25 = 5 pages. **PASS.**
- **D05** independent re-drive: NOT driven this round. Requires a dedicated R41-class real-Stripe disposable session (fresh signup + hosted Checkout + grace transition + resubscribe; QA Task 21 was an entire session for this lifecycle). Wallet-unfreeze step remains independently proven by DT-118's fresh-disposable live-verify (bb862192, 2026-09-06) — source + deployed parity at HEAD confirmed. Named legs still owed: **positive** — real sub active → admin/manual cancel → grace (wallet frozen) → resubscribe → `sp_wallets.state='active'` + grace cleared; **negative** — resubscribe without renewal / EF loud-failure path. See Known Gaps.
- **G01**: real Stripe Connect onboarding not driven — no fresh un-onboarded test Connect account was provisioned this round (per brief's allowance). Standing test-seller Connect account (`acct_1U9DMMKX7Q9JD914`) remains the only verified one.

---

## R62b — app-wide off-brand-hex grep (grep -rE substitute — `rg` is NOT installed on this machine)

`grep -rEn "#4A7C59|#4D4D4D|#808080" p2p-kids-marketplace/src`:
- **SellerEarningsScreen.tsx** (DEPRECATED DT-86, no active navigation) — reported, not re-flagged.
- **LeaderboardScreen.tsx** (registered, deferred post-MVP, no deep-link/caller) — reported, not re-flagged.
- **ContinueKidsClubScreen.tsx:31** — explanatory BP-82 comment only (no style).
- All 8 DT-119 target files clean.

On-device full-frame presence scans (vs a canonical-screen AA baseline of ~0.01–0.06% for the gray hexes) confirmed the same on every screen rendered: **zero #4A7C59 anywhere reachable.**

---

## Perceived load-time notes (§5.7 / R50)

Perceived load times (simulator, wall-clock, ±polling-interval precision — NOT a formal performance profile):
| Screen → transition | Elapsed (observed) |
|---|---|
| ContinueKidsClub deep-link render (each state) | ~1–2s (≤2 tree polls) |
| ManageKidsClub / TransactionHistory / LinkedAccounts deep-link renders | ~1–2s |
| Payout Settings initial load (hero + method + history) | ~1.5–2.5s |
| Load More page-2/page-3 append | ~1s |
No transition reached 3s. **Perceived Load-Time Verdict: GOOD.**

---

## Findings

### Design / copy
- **No Design-System DEVIATIONS found on any reachable branch** of the 8 DT-119 screens. The D1 defect class (off-brand `#4A7C59` on the ContinueKidsClub upsell branch) is **fixed and verified on-device** on the branch QA Task 34 missed.
- **LOW (semantic edge):** a `requires_action` payout's history row shows gross=net ($20.00) because no fee is computable until a method is set (provider null). Consistent, but the history note's "amounts below are what you receive after… fee" is technically only meaningful once a method exists. Not a defect — noted for the dev team's awareness.

### Doc / fixture gaps (not defects)
1. **`test-trial@` persona is unprovisioned on staging** (guide SUB N06 actor). ContinueKidsClub trial-≤7d (and trial->7d) cannot be rendered on-device. Recommend a `qa:r41-trial`-class fixture (disposable, `subscriptions.status='trial'` + `trial_end_date` within 7 days) — closes SUB N06's last leg AND completes Batch A's R62a coverage.
2. **ManageKidsClub `badge_free`** is dead for actual free users (the free state returns early with "You don't have an active…" and no badge). DT-119's `badge_free`→#6B6B6B is on a style not rendered in the current free flow (source note).
3. **`rg` not installed** on this machine — the standing R62b grep used `grep -rE` as the equivalent (substitute noted for the playbook).

### Friction vs operating rules
- **badge-scan region scans returned 0 for known-text bands** several times (empty-state text, SubscriptionStatus text) even where full-frame scans found the color. Root cause not fully resolved — the dependable pattern this round was **full-frame presence scans compared against a canonical-screen AA baseline** (~0.01–0.06% for AA noise) + source verification. Recommend noting this in the playbook (region-scan coordinates appear unreliable; full-frame + baseline is the stable method).
- **PayoutSettings scroll** worked this build (~200–260pt swipes from the list) — the QA Task 33 "scroll-resistant ~0 movement" observation did NOT reproduce; treat as build-dependent.

---

## App state left behind / cleanup (DB-verified)

- **qa-payout-seller fixture reset to clean baseline** (`qa:payout-fixture reset` → 0 methods / 0 payouts / 0 trades / 0 items / balance 0-0-0; active sub intact; persona kept for reuse). DB-verified: 0 methods, 0 payouts, 0 `fixture:qa_payout_trade:` trades.
- **test-expired `/subscription/status` notification removed** (r41-sub `--remove`). DB-verified 0 residue.
- **test-seller untouched** (read-only + Load More fetches only): seller_balance $140.40 / $442.60 / $583.00 + 25 payouts intact (DB-verified).
- No `admin_config` writes this round. No Stripe objects created (the requires_action payout was DB-controlled; no real transfer minted).
- Logged out; app left on Landing. Simulator left booted.
- Evidence screenshots: `screenshots/A1–A5-continue-*.png`, `B1–B11-*.png`, `C1/C2-*.png`, `D1-friendly-unverified-copy.png`, `F1-test-seller-loadmore-15rows.png`.

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 35 — DT-119 live verification across every reachable branch/state (R62a) + payout follow-ups + remaining SUB items. Batch A ContinueKidsClub states (active/free/grace/expired/grace_period + trial source-audit) · Batch B the 7 other fixed screens (ManageKidsClub active+expired, SubscriptionStatus, PaymentMethods, TransactionHistory empty+populated, LinkedAccounts, TradeTimeline completed+cancelled, PayoutSettings pending color) · Batch C requires_action → Set Up Payout Method · Batch D friendly unverified-method copy · Batch E gross/net footnotes · Batch F F08/G10 pagination (D05/G01 deferred).
**Design-System Compliance:** PASS — no deviations on any reachable branch of the 8 DT-119 screens. D1 (ContinueKidsClub upsell `#4A7C59`) verified FIXED on-device; pending color #FFA726; ManageKidsClub expired badge #6B6B6B; SubscriptionStatus #999999; all greys canonical (#6B6B6B/#999999). Remaining source hits confined to deprecated SellerEarnings + deferred Leaderboard (reported, not re-flagged per R62b).
**Perceived Load-Time Verdict:** GOOD — all observed transitions <3s (deep-link renders ~1–2s; Payout Settings ~1.5–2.5s; Load More ~1s). See load-time table.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ContinueKidsClub active branch: wording/layout on-design ("✓ You're all set", benefits recap, Manage primary).
- CONFIRMED — ContinueKidsClub free/grace/expired/grace_period upsell: positive "X free days • no charge today" pill + "Start Kids Club+" + fine-print — on-design.
- CONFIRMED — ManageKidsClub (active + expired): status/next-billing/expired info box copy on-design.
- CONFIRMED — SubscriptionStatus: diagnostic status screen copy on-design (dev-facing diagnostic is expected surface).
- CONFIRMED — PaymentMethods, TransactionHistory, LinkedAccounts: copy/layout on-design.
- CONFIRMED — TradeTimeline completed/cancelled: status banners + payment details on-design.
- CONFIRMED — Payout Settings: hero footnote + history note copy plain and clear (gross vs net now explained).
- CONFIRMED — Withdrawal-Failed alert (Batch D): friendly unverified-method copy on-design.
- CONFIRMED — Add Payout Method modal (Batch C): method-option copy on-design.
**Verdict Summary:** 13 PASS / 0 FAIL / 0 BLOCKED / 2 PARTIAL (trial-branch source-audited-only — on-device render fixture-gapped; D05+G01 fixture-gated, documented).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — SUB-TC-F08 🟡→✅, SUB-TC-G10 🟡→✅, SUB-TC-G06 🟡→✅ (DT-119 re-verify); SUB-TC-G05 + F06 notes refreshed; SUB-TC-N06 remaining note updated. New SUB totals: PASS 72 · PARTIAL 2 · OPEN 3 · Remaining (ACTIVE) 6 (§1 roll-up + section header both updated).
**Critical Findings:** (1) [RESOLVED-VERIFIED] QA Task 34's D1 (ContinueKidsClub upsell off-brand #4A7C59) is FIXED on-device — zero #4A7C59 on every reachable branch; R62a prevented a repeat miss and this round's all-branches audit confirmed it. (2) [RESOLVED-VERIFIED] QA Task 34's G06 PARTIAL (no Set Up Payout Method CTA on requires_action rows) is FIXED — the CTA renders and opens the Add Payout Method flow. (3) [RESOLVED-VERIFIED] raw "Primary payout method is not verified" reject is now the friendly copy (Batch D). (4) [LOW, non-blocking] requires_action history row shows gross=net (no fee computable without a method) — noted, not a defect. (5) [Fixture gap] no standing trial-status persona on staging → ContinueKidsClub trial-≤7d branch not on-device renderable (guide's `test-trial@` unprovisioned).
**App State Left Behind:** All fixtures reverted/deleted + DB-verified (qa-payout-seller 0/0/0/0, active sub intact; test-expired notif removed; test-seller untouched $140.40/$442.60/$583.00, 25 payouts). No admin_config writes, no Stripe objects. Logged out at Landing.
**Why It Matters:** This round is the first real application of R62a (audit EVERY rendered branch) and confirms it works — the exact branch-drift class QA Task 34 missed (the upsell branch) is now verified clean across every on-device-reachable state, and the three payout fixes that QA Task 34 flagged as gaps (G06 CTA, G05 copy, F08/G10 pagination) are all live. It proves DT-119's branding sweep didn't just fix the flagged branch but left no sibling-branch drift.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task35-dt119-branches-sub-2026-09-05/screenshots/` (A1–A5 ContinueKidsClub states, B1–B11 screens, C1/C2 requires_action CTA + modal, D1 friendly alert, F1 Load More 15 rows). Reproduce: `qa-login-as` each persona → `p2pkidsmarketplace://continue-kids-club` (or `manage-kids-club` / `linked-accounts` / `billing-history`); qa-payout-seller fixture `qa:payout-fixture ensure/methods/stage-trade/balance` for Batch C/D.
**Known Gaps / Not Tested:** (1) ContinueKidsClub trial-≤7d + trial->7d ON-DEVICE renders — no `trial` persona on staging (fixture gap); styles source-audited canonical. (2) D05 independent re-drive — not run (requires dedicated R41-class real-Stripe disposable fixture session). Missing legs named: POSITIVE real sub active→grace→resubscribe→wallet unfreeze; NEGATIVE resubscribe-without-renewal/EF-loud-failure. (3) G01 real Stripe Connect onboarding — pending a fresh un-onboarded test Connect account (per brief allowance). (4) TradeTimeline in-progress/disputed states not separately rendered (no standing fixture); bundleItemPrice is a shared style verified at source + completed/cancelled renders clean. (5) ManageKidsClub free badge (badge_free) not exercised — free users get the no-active-sub early-return.
**What Needs To Be Fixed Next:** (1) Dev fixture: provision a standing `test-trial`-class persona (`subscriptions.status='trial'` + `trial_end_date` within 7 days, e.g. a `qa:r41-trial` command) so SUB N06 + ContinueKidsClub trial branches are on-device testable — also unprovisions the guide's `test-trial@` actor. (2) Dev: decide whether `ManageKidsClubScreen.badge_free` should be reachable for free users or is intentionally dead in the early-return branch (report as design intent). (3) QA tooling: add `--coords`/region reliability to `qa:badge-scan` region scans (this round region scans returned 0 for known text bands while full-frame scans worked — document full-frame + AA-baseline as the standard). (4) QA tooling/environment: note `rg` is absent on this machine — the R62b grep used `grep -rE`; add rg to the environment or codify the grep substitute. (5) [Scheduled, separate] D05 + G01 dedicated real-Stripe fixture session (R41 discipline).
**UX Enhancement Ideas (optional, not defects):** None this run — no friction or enhancement opportunities observed beyond what's noted above.
**Suggested Next Session:** The dedicated real-Stripe disposable fixture session (D05 independent re-drive + G01 Connect onboarding provisioning), per R41 — closes the two remaining Batch-F legs; then re-run any copy-invalidated SUB rows.
**Suggested to Improve Agent Rules:** Codify the on-device R62b method used this round into the playbook §5.63: run the app-wide grep with `grep -rE` when `rg` is absent, AND for each rendered screen run a **full-frame off-brand-hex presence scan** (badge-scan, whole image, legacy 3-hex tokens) and compare to a canonical-screen AA baseline (~0.01–0.06%) rather than trusting per-region scans (which returned false zeros this round). Also record that the ContinueKidsClub **upsell branch** (not just active) must be in every future ContinueKidsClub review — the R62a check that caught the original D1.
