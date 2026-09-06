# QA Task 34 — Payout E2E: Positive + Negative (v2) — qa-payout-seller fixture (Dev Task 118)

- **Date:** 2026-09-05 (local) / 2026-09-06 UTC
- **Run folder:** `e2e-test-results/qa-task34-payout-e2e-2026-09-05/`
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1), dev build via Metro `:8081`
- **Personas:** `qa-payout-seller` (DT118 fixture, disposable, fixed UUID `a1234567-…-f2`), `test-seller` (balance-hero/F07/K02/ContinueKidsClub legs)
- **Canonical guide:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` (Groups F/G/H + D05/K02)
- **Method:** `mobile-mcp` (AX tree + screenshot/OCR + DB read-back per R24/R11). All money/SP assertions DB-read-backed.

---

## ⭐ THE ANSWER TO THE ROUND'S QUESTION

> **YES — a seller can withdraw money, and the failure paths work.**
>
> - **Positive path (H03):** with a verified primary method + a controlled available balance, **Withdraw Now → Confirm Withdrawal succeeds end-to-end on the live surface**: the real `request_seller_payout` RPC created a genuine `seller_payouts` row (`899e70cf`, gross 500 / payout_fee 26 / net 474 / status `processing` / provider `stripe`), the available balance decremented correctly ($5.00 → $0.00, DB + hero), the fee math is provider-attributed and correct ($0.25 + 0.25% Stripe = $0.26), the mobile hero + history refreshed to show the payout Pending ($4.74 net, "Stripe fee: $0.26"), and the success alert copy matches the guide. No real outgoing transfer is minted (the documented synthetic-account boundary — this is the exact safety QA needs).
> - **Failure paths all verified:** **H01** no-balance → "No Balance" alert, no modal, no payout. **H04/G11** no method → NoMethodModal "Payment Method Required" (exact copy), Cancel dismisses with no payout. **G05** unverified (primary-row) method → the RPC **rejects at Confirm** ("Withdrawal Failed / Primary payout method is not verified"), zero payout rows, balance unchanged. **H06** below the live $2.00 floor → "Minimum withdrawal amount is $2.00", no payout. **H07** floor disabled (config=0) → the same $1.50 withdrawal then **succeeds** (payout `a5352ce1`), config reverted + verified.
> - **Guard structure note (not a defect):** the withdraw *client* gate keys off `is_primary`; the *server* (`request_seller_payout`) enforces `is_verified`. So a first-added-but-unverified method that is the auto-primary row opens the WithdrawModal and is rejected clearly at Confirm rather than pre-empted by the NoMethodModal (guide's G05 phrasing is doc-drift for that state).

**Cases that still can't close (precise reasons):** G06's "[Set Up Payout Method]" CTA leg (the CTA does not exist on the live PayoutSettings history card — source-proven; the guide targets the dead SellerEarnings screen); the Pending→Available release transition for F06 (requires dispatching the synthetic payout toward a non-real Connect account — unsafe/unsanctioned); D05's fresh independent re-drive (requires a fresh real-Stripe disposable — DT118's identical live-verify is cross-referenced, verified unchanged); F08/G10 pagination tap (now drivable by the new testID — owed on a >5-row seller).

---

## Verdict roll-up

| TC-ID | Verdict | Guide | Summary |
|---|---|---|---|
| SUB-TC-H03 | ✅ PASS | SUB | Real positive withdrawal E2E (see above) |
| SUB-TC-H01 | ✅ PASS | SUB | No-balance guard (copy exact) — brief's "over-balance red-border" framing is doc-drift vs canonical guide |
| SUB-TC-H04 | ✅ PASS | SUB | No-method → Payment Method Required modal |
| SUB-TC-G11 | ✅ PASS | SUB | NoMethodModal flow (copy exact, Cancel clean) |
| SUB-TC-G05 | ✅ PASS | SUB | Unverified (auto-primary) method → RPC reject at Confirm, no payout (doc-drift note vs guide's NoMethodModal expectation) |
| SUB-TC-H06 | ✅ PASS | SUB | Below live $2.00 floor → "Minimum withdrawal amount is $2.00", no payout |
| SUB-TC-H07 | ✅ PASS | SUB | Config 200→0 (scope-write) → below-floor withdrawal succeeds; reverted + verified |
| SUB-TC-F06 | ✅ PASS | SUB | stage-trade earnings show under Pending ($20.00), not Available; release-transition leg not driven (boundary) |
| SUB-TC-G04 | ✅ PASS | SUB | Set-primary highlight move + delete-with-confirmation (DB-verified) |
| SUB-TC-G09 | ✅ PASS | SUB | "Cannot Set as Primary" guard (unverified radio) — exact guide copy |
| SUB-TC-G06 | 🟡 PARTIAL | SUB | requires_action row renders "Action Required"; guide's Set-Up-Payout-Method CTA not on live surface (doc-drift to dead SellerEarnings) |
| SUB-TC-F05 | ✅ PASS | SUB | Empty-state "No payouts yet" (clean no-payout states) |
| SUB-TC-F07 | ✅ PASS | SUB | `payout_fetch_failure` armed → error Alert; disarmed → recovery |
| SUB-TC-K02 | ✅ PASS | SUB | Transaction History empty + error/Retry + recovery |
| SUB-TC-D05 | ✅ PASS (cross-ref) | SUB | DT118 fix verified in place (EF v-at-HEAD, step-9 service-role unfreeze + loud failure); fresh re-drive needs real-Stripe disposable |

**Batch-D DT118 fix re-verifications:** test-seller reconciled hero ($140.40 / $442.60 / $583 / 25 trades) ✓ · WithdrawModal fee label + footnote (item 5) ✓ · history "<Provider> fee:" + note (item 9) ✓ · Load More testID + pill-clear (item 4) ✓ · ContinueKidsClub active-state landing + Manage Kids Club+ nav (item 8) ✓ · `payout_fetch_failure` F07 + K02 error/Retry (item 7) ✓.

---

## Execution trace (per case)

### Batch A — H03 positive
1. `ensure` → clean baseline (0/0/0, no methods/payouts/trades, sub active). `methods --scenario single-verified`; `balance --amount 500`.
2. Login `qa-login-as?persona=qa-payout-seller` → Home → `action-tile-payouts` → Payout Settings. Hero: Available **$5.00** / Pending $0.00 / Lifetime $5.00; verified Stripe primary (`radio-btn` "Current primary method"); history "No payouts yet".
3. Withdraw Now → **WithdrawModal** (native modal; buttons not AX-exposed per §5.31 — pixel/OCR located): Available $5.00 · "Payout processing fee (Stripe): -$0.26" · footnote · You'll Receive **$4.74** · Payout Method Stripe (acct_****ture). Fee = $0.25 + 0.25%×500 = $0.26 ✓.
4. Confirm (green pill, pt ~330,627) → native alert **"Withdrawal Requested / Your withdrawal of $5.00 has been initiated. After fees, you will receive $4.74."** (OCR). OK.
5. UI after: Available **$0.00**, Pending $4.74, history row `899e70cf` **$4.74 Processing / Sep 5 / "Stripe fee: $0.26"**, Load More button now present **at y644 clear of the pill band** (DT118 item 4).
6. DB (R24): `seller_payouts` row `899e70cf` (gross 500 / platform_fee 0 / payout_fee 26 / net 474 / processing / stripe / trade_id NULL); `seller_balance.available` 500→0. **H03 PASS.**
   - **Note:** after the withdrawal the hero shows Pending $4.74 / Lifetime $0.00 via `getSellerBalance`'s self-heal derive (pending = live in-flight payout net; lifetime = completed-trade sum = 0 for this synthetic non-trade-backed balance). Not an app defect — fixture semantics on a 0-completed-trade persona.

### Batch B — negatives
- **H01:** reset → single-verified + balance $5.00 → withdraw to $0 → Withdraw Now with $0.00 available → **"No Balance / You have no available balance to withdraw"** (AX-exposed GlobalAlert). No modal, no payout. **PASS.** *Doc-drift:* the brief's "over-balance red-border / Confirm disabled" describes the dead `RequestPayoutScreen` amount-entry flow — the live surface withdraws full-available only (guide H01 rewritten 2026-09-02).
- **H04/G11:** `methods --scenario none` + balance $5.00 → remount → Withdraw Now → **NoMethodModal** "Payment Method Required" / "To withdraw your earnings, you need to add and verify a payout method first." + Add Payout Method (`no-method-add-btn`) + Cancel. Cancel → dismissed; balance $5.00 unchanged; DB payout count 0. **PASS.** (Add Payout Method's destination = real Stripe Connect onboarding — G01 boundary, noted.)
- **G05 + G09:** `methods --scenario single-unverified` (fixture creates an **unverified auto-primary** row `ed620013`, is_primary=true, is_verified=false, "Onboarding required"). Remount → method card status **"Onboarding required"**, radio AX label "Cannot set as primary — Onboarding required".
  - Radio tap → **"Cannot Set as Primary" / `This method has status "Onboarding required". Please wait until it is verified before setting it as primary.`** — exact guide G09 copy. **G09 PASS.**
  - Withdraw Now → WithdrawModal opens (client keys off is_primary) → Confirm → **"Withdrawal Failed / Primary payout method is not verified"** (server RPC enforces is_verified). DB: 0 payout rows, available 500 unchanged. **G05 PASS.**
  - *Finding (LOW copy):* "Primary payout method is not verified" is clear but terse/machine-y; suggestion below. *Doc-drift:* guide G05 expects the client NoMethodModal on Withdraw-Now when only an unverified method exists; actual = the client shows the WithdrawModal and the server rejects at Confirm. The guard exists and no money moves — intent met.
- **H06:** `methods --scenario single-verified` + `balance --amount 150` ($1.50 < live floor 200). Remount → hero $1.50, verified primary. Withdraw Now → WithdrawModal → Confirm → **"Withdrawal Failed / Minimum withdrawal amount is $2.00"** (live config floor, client+RPC). DB: 0 rows, available 150. **PASS.**
- **H07:** `qa:admin-config-set` wrote `minimum_withdrawal_amount_cents` **200→0** (category `fees`, data_type `number`; read-back verified). Confirm on the still-open $1.50 modal → **success**: "Withdrawal Requested / Your withdrawal of $1.50 … receive $1.25." (hero $0.00; history + Load More). DB: payout `a5352ce1` (gross 150 / payout_fee 25 / net 125 / processing). **Reverted** to 200 + read-back verified (`updated_by` null preserved). **PASS.**

### Batch C — also-close
- **F05:** empty-state "No payouts yet" captured across multiple clean no-payout states (H03-base, H04-state). **PASS.**
- **F06:** reset → `single-verified` → `stage-trade --amount 2000` → genuine payout `b525951a` **status pending**, release `+2d` (2026-09-08); reconcile pending=2000. Remount → hero **Available $0.00 / Pending $20.00 / Lifetime $20.00**; history `$19.70 Pending / "Stripe fee: $0.30"`; verified primary "Verified & Active". DB: payout gross 2000 / fee 30 / net 1970 / pending / trade `07c324bd`. **PASS (Pending leg).**
  - *Payout-earnings semantics note (LOW):* hero Pending shows the **reconcile gross** ($20.00) while the history row shows the **net** ($19.70 after the $0.30 Stripe fee) — the two surfaces disagree by the fee. The client derive path sums payout *nets*; `reconcile_seller_balance` stores pending as the *gross*. Recommend dev align pending semantics (a user may read "Pending $20" and expect to receive $20).
  - *Release-transition leg NOT driven:* Pending→Available requires the payout to complete (dispatch via `release-due-payouts` toward the Connect account). The synthetic method has no real Connect account; dispatching would fail/be unsafe and the runbook mandates `reset` before the 2-day buffer elapses. Real-Connect dispatch remains the documented follow-up (same boundary as G01).
- **G06:** with **no verified method**, `stage-trade` produced a **genuine `requires_action` payout** (`39b7e451`, release +2d) via `create_seller_payout_on_trade_completion`. Remount → history row renders **$20.00 "Action Required"** (red #E85D75 label, orange clock). **The guide's "[Set Up Payout Method]" button is NOT present** on the live `PayoutHistoryCard` (source-proven — no CTA in the card; the guide targets the dead `SellerEarningsScreen`). **PARTIAL** — row-render leg PASS; CTA leg doc-drift + UX gap (a seller seeing "Action Required" has no in-row way to act).
- **G04:** `methods --scenario two` (A primary + B verified secondary). Radio on B → "Success / Primary payout method updated", highlight moves to B (DB: B `is_primary=true`). Kebab on (now non-primary) A → sheet (Set as Primary / Edit Details / **Delete Method** / Cancel — all AX-exposed) → Delete Method → "Delete Payout Method / Are you sure you want to remove Stripe (acct_****re_a)?" → Delete → "Deleted / Payout method removed successfully." DB: only B remains. **PASS.**

### Batch D — DT118 re-verification
- **test-seller reconciled hero:** login test-seller → Payout Settings → hero **Available $140.40 / Pending $442.60 / Lifetime $583.00**; DB `seller_balance` = 14040 / 44260 / 58300 / **total_trades_completed 25**. (DT118 Item-2 reconcile verified on-device + DB.) History rows show provider fee labels ("Stripe fee: $0.29–$0.39") on the populated list — item-9 fix verified.
- **F07:** armed `qa-dev-toggle?key=payout_fetch_failure&value=fetch_failure` → remount → Error Alert **"Failed to load payout data. Please try again."** (exact guide copy). Disarmed → remount → hero **$140.40** loads. **PASS.**
- **K02:** test-seller has 0 `billing_history` rows → `billing-history` deep link → Transaction History **"No billing history yet."** (receipt). Arm `payout_fetch_failure` → remount → **"Failed to load billing history" + [Retry]**; disarm → Retry → recovers to empty. **PASS.**
- **ContinueKidsClub (item 8):** test-seller is actually **grace_period** (trial ended 09-01) → correctly shows the Start/upsell branch (canonical 4 benefits + "Flat $1.49 Safety & Platform Fee" — DT118 follow-up benefits fix visible). Switched to **qa-payout-seller** (genuinely active) → `continue-kids-club` deep link → **enriched active-state landing**: 🎉 "Kids Club+ Active" + "✓ You're all set" pill + benefits recap + **Manage Kids Club+** primary (`continue-active-manage-btn`) → navigated to **Manage Kids Club+** (Status Active, Next Billing Oct 5 2026, 30 days). **Item 8 PASS.**
- **Fee labels (items 5/9):** verified in the H03 flow + test-seller history (see above). **Item 4 (Load More):** testID present + pill-clear position verified in H03. 
- **D05:** cross-referenced from DT118's fresh-disposable live-verify (2026-09-06, `bb862192`), with **source + deployed-parity verified unchanged** this round: `renew-subscription` EF at HEAD `5ef735fa` (the DT118 commit) carries step 9's dedicated service-role `rpc_set_sp_wallet_state(p_state:'active')` + loud-failure (`sp_wallet_unfrozen:false`). A fresh independent re-drive needs a real-Stripe disposable (dedicated fixture session per R41 discipline) — recorded as a Known Gap, not silently skipped.

---

## Perceived load-time notes (§5.7)

Perceived load times (simulator, wall-clock, ±polling-interval precision — not a formal profile):
- Payout Settings initial load (hero + method + first-5 history) on qa-payout-seller/test-seller: **~1.5–2.5s** — under the 3s flag threshold; no loading-state concern (hero appeared with the figures in ≤2 polls).
- ContinueKidsClub active branch mount via deep link: **~1–2s**.
- No transitions exceeded 3s this round.

---

## Findings

### Design-System DEVIATION — D1 (owner-flagged, HIGH) — ContinueKidsClub upsell branch is off-brand

**Owner flagged 2026-09-05 after the run:** the ContinueKidsClub screen ("Start Kids Club+" upsell branch, rendered for trial / free / grace / expired users — i.e. anyone NOT currently active) does not follow the design-requirement colors. Confirmed from source + the run's on-device screenshot: `p2p-kids-marketplace/src/screens/subscription/ContinueKidsClubScreen.tsx` upsell-branch styles use **`#4A7C59` (a dark forest green that is NOT a canonical token)** for the price card and the primary "Join Kids Club+ on the web" CTA, plus non-canonical greys. Canonical reference: `docx/design-system-passitup.md` (primary green **`#5DBB8E`**, secondary text `#6B6B6B`, tertiary `#999999`, bg `#FAFAFA`).

**Off-brand tokens found (source-verified):**
- `pricingCard` `backgroundColor/shadowColor` `#4A7C59` + `primaryButton` `backgroundColor/shadowColor` `#4A7C59` (the "dark green" price card + web CTA) → canonical **`#5DBB8E`**.
- `secondaryButton` `borderColor` + `secondaryButtonText` `color` `#4A7C59` → **`#5DBB8E`** (canonical outline = 2px `#5DBB8E`).
- `benefitText`/`description` `#4D4D4D` → **`#6B6B6B`** (secondary body); `loadingText`/`textButtonText` ("Maybe later") `#808080` → **`#6B6B6B`**; `finePrint` `#808080` → **`#999999`** (tertiary/hint).
- On-token (not deviations): bg `#FAFAFA`, headings `#1A1A1A`, and the urgency pill `#FFF3E0`/`#FFA726` (canonical warning pair — semantically an urgency banner reading as warning, optional product glance).

**Aggravating context:** this is the same off-brand `#4A7C59` (legacy `ds.primary[500]` from the old design-system.md) previously flagged on Discover (Phase 24) — and it is an **internal inconsistency on the same file**: the DT118 item-8 **active** branch styles (lower in the same file) correctly use `#5DBB8E`/`#E8F5F0`, so the branch most users actually see (everyone not currently a Kids Club+ active member) is the off-brand leftover.

**Fix (recommended dev follow-up — QA is execution-only and did not apply):** in `ContinueKidsClubScreen.tsx`, remap the upsell-branch styles to canonical tokens (prefer importing the shared semantic colors/design-token object over hardcoded hex): `#4A7C59 → #5DBB8E` (pricingCard, primaryButton, secondaryButton border/text, shadowColors), `#4D4D4D → #6B6B6B` (benefitText, description), `#808080 → #6B6B6B` (loadingText, textButtonText) / `#999999` (finePrint). Sweep `src/screens/subscription/` (and app-wide) for other `#4A7C59`/`#4D4D4D`/`#808080` uses of the same off-brand class.

### Doc-drift / guide gaps
1. **G06** — guide expects a "[Set Up Payout Method]" button on a requires_action payout; the live PayoutSettings history card has **no CTA** (source-proven: `PayoutHistoryCard` in `PayoutSettingsScreen.tsx` renders only status label + fee). Guide targets the dead `SellerEarningsScreen`. (PARTIAL verdict + UX note.)
2. **G05 / H01 brief-vs-guide** — the task brief's H01 "over-balance red-border / Confirm disabled" and G05 "Verification Required alert" describe the dead `RequestPayoutScreen` amount-entry model. Live surface (guide, rewritten 2026-09-02) = full-balance WithdrawModal; the unverified guard fires at the RPC with "Primary payout method is not verified".
3. **Hero Pending = gross vs history net** (F06) — `reconcile_seller_balance` stores pending as gross; the hero shows $20.00 while the payout row/history net is $19.70. Recommend a dev decision on whether Pending should be gross-reserved or net-receivable (the client derive path already uses net).

### UX / copy (R58 audit)
4. **LOW** — "Primary payout method is not verified" (withdrawal reject) is understandable but terse. Suggest: *"Your payout method isn't verified yet. Please finish verifying it before withdrawing."*
5. **UX gap (G06 class)** — a `requires_action` payout ("Action Required") gives the seller no in-row action. Suggest a "Set Up Payout Method" affordance on requires_action rows that routes to the method setup (matches the guide's original G06 intent and gives sellers a way to resolve the state).

### Non-issues observed (recorded so they are not re-flagged)
- H03's post-withdrawal "Lifetime $0.00" is the `getSellerBalance` self-heal derive on a synthetic (non-trade-backed) fixture balance — correct behavior on real sellers (test-seller's $583 lifetime derives from real completed trades). Not a defect.
- qa-payout-seller's ContinueKidsClub **active** branch verified on-device (on-brand `#5DBB8E` active styles — DT118 item 8). test-seller (grace_period sub) state-correctly shows the Start/upsell branch — **but that upsell branch is off-brand (`#4A7C59`) — see Design-System DEVIATION D1**. test-seller's subscription status is `grace_period` (trial ended 2026-09-01, grace until 2028) — worth noting for any future "active member" surface testing on test-seller.

### Housekeeping (not blocking — from the brief)
- `docs/flow-registry.md` entries for the flows touched by Dev Task 118 were not updated — flag for a future light documentation pass.

---

## App state left behind / cleanup

- **qa-payout-seller fixture reset to clean baseline** (`npm run qa:payout-fixture -- reset` → 0 methods / 0 payouts / 0 trades / 0 items / balance 0-0-0; persona kept for reuse). DB-verified 0/0/0/0 residue.
- **`minimum_withdrawal_amount_cents` reverted to 200** and DB read-back verified.
- **`payout_fetch_failure` toggle disarmed** (`none`).
- **test-seller untouched** — balance hero + seller_balance row unchanged (read-only this round beyond the H03-era reconciles which are the DT118 baseline).
- Logged out; app left on Landing. Simulator left booted.
- **Stripe test-mode objects:** none created this round (the withdrawal path mints no outgoing transfer on the synthetic method; stage-trade payouts were all reset before any release). Harmless test-mode residue: none expected.

Evidence screenshots: `screenshots/A-H03-*.png` (base, modal, alert, post-state), `B-H04-no-method-state.png`, `B-G11-H04-no-method-modal.png`, `B-G05-unverified-withdraw-modal.png`, `B-H06-*.png`, `B-H07-withdrawal-success-alert.png`, `C-G06-requires-action-row.png`, `D-test-seller-reconciled-hero.png`, `D-continue-kids-club-manage-nav.png`.

Per-case trace + DB read-backs are inline in this report; full tool-call trace available in the session.
