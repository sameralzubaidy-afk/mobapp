# QA Task 11 — Groups N, O, P, Q, R (Rev 3) — Batch Report

**Date:** 2026-08-30 · **Agent:** QA Test Agent (execution-only) · **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`)
**Device:** iOS Simulator — iPhone 17 Pro Max (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**Backend:** Supabase staging `drntwgporzabmxdqykrp`
**Evidence dir:** `e2e-test-results/qa-task11-nopqr-2026-08-30/screenshots/`

---

## 1. Batch verdict table

### Group N — Minimum listing price (TradeFlow V2)

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| TRD-TC-N04 | TradeFlowV2 | ✅ PASS | $3 → "Let's Adjust Your Price" modal; $20 published (DB item `755e1774` pending $20, no $3 item) |
| TRD-TC-N05 | TradeFlowV2 | 🚫 BLOCKED | Bulk per-item form not reliably drivable; publish gated w/ incomplete items; source-confirmed flag logic |
| TRD-TC-N06 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-web auto-pause (Playwright surface) |
| TRD-TC-N09 | TradeFlowV2 | ✅ PASS | Modal copy "$5.00 or more" + Update Price button (94.87% #5DBB8E) |
| TRD-TC-N10 | TradeFlowV2 | ✅ PASS | Update Price dismisses + auto-scroll/focus price field (y≈462, "3") |
| TRD-TC-N11 | TradeFlowV2 | ✅ PASS | Edit flow → same modal; DB Puzzle Set dd8fc177 still $18 (not saved) |
| TRD-TC-N12 | TradeFlowV2 | ✅ PASS | Bulk Item 3 chip: "Missing: Title, Condition, Price, Price must be $5.00+" |
| TRD-TC-N13 | TradeFlowV2 | 🚫 BLOCKED | Same bulk driving limitation; publish gate source-confirmed |
| TRD-TC-N14 | TradeFlowV2 | ⚠️ PARTIAL | Single+edit regression legs PASS; bulk leg shares N05/N13 limitation |

### Group O — End-user tax

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| TRD-TC-O01 | TradeFlowV2 | ✅ PASS | Offer $30 / Fee $1.49 / Sales Tax **$2.10** / Total $33.59 (live 6.99% rule) |
| TRD-TC-O02 | TradeFlowV2 | ✅ PASS | SP=4 → tax stays $2.10 on full $30 base (BP-37) |
| TRD-TC-O03 | TradeFlowV2 | ❌ **FAIL** | Global toggle `sales_tax_enabled=false` did NOT zero tax (real bug) |
| TRD-TC-O04 | TradeFlowV2 | ⚠️ PARTIAL | Rule engine overrides node rate 6.35% → node-toggle not observable mobile |
| TRD-TC-O05 | TradeFlowV2 | ✅ PASS | Books/exempt: "Tax Free" badge + $0.00 on detail & offer |
| TRD-TC-O06 | TradeFlowV2 | ✅ PASS | Completed trade Payment Details: Paid $18 / $1.49 / Sales Tax $1.26 / Total $20.75 |
| TRD-TC-O07 | TradeFlowV2 | ⏭️ DEFERRED | Guide entry ⏭️; related R05/R06 voids tax rather than proportional refund (staging) |
| TRD-TC-O08 | TradeFlowV2 | ✅ PASS | Buyer sees "Estimated Sales Tax"; seller does NOT |
| TRD-TC-O1 | TradeFlowV2 | ⚠️ PARTIAL | Admin rule creation = Playwright; C05/C06 queries confirm rule-override mapping |
| TRD-TC-O2 | TradeFlowV2 | ✅ PASS | Mobile leg: quote/authorize-not-collect confirmed (capture on accept) |
| TRD-TC-O3 | TradeFlowV2 | ✅ PASS | Mobile leg: "Payment authorized" wording while Awaiting Seller confirmed |

### Group P — Tax Admin

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| TRD-TC-P01 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-UI; finding: category rules override node rate |
| TRD-TC-P02 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-UI (Playwright) |
| TRD-TC-P03 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-UI (Playwright) |
| TRD-TC-P04 | TradeFlowV2 | ❌ **FAIL** | Mobile leg = O03 bug: global toggle ignored, tax still charged |
| TRD-TC-P05 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-UI (Playwright) |
| TRD-TC-P06 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-UI (Playwright) |
| TRD-TC-P07 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin-UI (Playwright) |
| TRD-TC-P08 | TradeFlowV2 | ⚠️ PARTIAL | New transactions use RULE rate (6.99%) — node-rate edits do NOT propagate |

### Group Q — Reviews & Ratings

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| TRD-TC-Q01 | TradeFlowV2 | ✅ PASS | Rate Seller prompt on Trade Complete |
| TRD-TC-Q02 | TradeFlowV2 | ✅ PASS | "Rating Required / Please select a star rating before submitting." |
| TRD-TC-Q03 | TradeFlowV2 | ✅ PASS | Char-count "28/500"; maxLength 500 |
| TRD-TC-Q04 | TradeFlowV2 | ✅ PASS | is_anonymous=true; profile "Anonymous User" |
| TRD-TC-Q05 | TradeFlowV2 | ⏭️ DEFERRED | Skip-review not UI-verified this run (budget) |
| TRD-TC-Q06 | TradeFlowV2 | ✅ PASS | "You have reviewed the seller" / "The seller hasn't reviewed you" |
| TRD-TC-Q07 | TradeFlowV2 | ✅ PASS | Review visible on seller profile (Anonymous User, 5★) |
| TRD-TC-Q08 | TradeFlowV2 | ✅ PASS | "4.5 / Based on 2 reviews", Reviews (2) |
| TRD-TC-Q09 | TradeFlowV2 | ✅ PASS | 5→1★ breakdown rows shown |
| TRD-TC-Q10/Q11 | TradeFlowV2 | ⏭️ DEFERRED | Edit window 24h — time-dependent |
| TRD-TC-Q12 | TradeFlowV2 | ✅ PASS | Review button gone after submit (no duplicate re-prompt) |
| TRD-TC-Q13/Q14 | TradeFlowV2 | ⏭️ DEFERRED | 30-day cooldown / 24h lock — time/multi-account dependent |
| TRD-TC-Q15/Q16/Q17 | TradeFlowV2 | ⏭️ DEFERRED | Flag/auto-hide/own-review — multi-account/admin; budget |
| TRD-TC-Q18–Q20 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin moderation queue (Playwright) |

### Group R — Refund & Cancellation state machine

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| TRD-TC-R01 | TradeFlowV2 | ✅ PASS | Buyer cancels pending → cancelled/"Changed mind"; listing restored available; auth released |
| TRD-TC-R02 | TradeFlowV2 | ✅ PASS | Seller declines pending → cancelled/"seller_declined"; listing restored available |
| TRD-TC-R03 | TradeFlowV2 | ✅ PASS | Offer expiry fast-clock → auto-cancel "Offer expired" + both-party notifications; listing restored |
| TRD-TC-R04 | TradeFlowV2 | ✅ PASS | Card declined → "Payment Hold Failed"; NO trade created |
| TRD-TC-R05 | TradeFlowV2 | ✅ PASS | Seller cancels in_progress → cancelled; listing restored; NO payout; tax voided |
| TRD-TC-R06 | TradeFlowV2 | ⚠️ PARTIAL | Staging capture simulated → cancel VOIDS tax/auth, no real refund row (finding) |
| TRD-TC-R07 | TradeFlowV2 | ⚠️ PARTIAL | SP-reversal path not exercised (all cash offers, 0 SP) |
| TRD-TC-R08 | TradeFlowV2 | ✅ PASS | No seller_payouts row for cancelled trade |
| TRD-TC-R09 | TradeFlowV2 | ⛔ OUT-OF-SCOPE | Admin dispute resolve (Playwright) |

### Rev 3 — IssueReportModal reason-row AX re-verify

| Item | Verdict | Top finding |
|---|---|---|
| IssueReportModal reason rows | ✅ RESOLVED | Fresh-session AX tree captures ALL 5 reasons + submit + cancel, stable across 2 listings. DT-67 partial capture = session/tooling artifact, NOT app regression. Container not surfaced = accepted-closed platform limitation (not re-flagged) |

---

## 2. Roll-up

| Verdict | Count |
|---|---|
| ✅ PASS | **27** |
| ❌ FAIL | **2** (O03, P04 — same root cause) |
| 🚫 BLOCKED | **2** (N05, N13) |
| ⚠️ PARTIAL | **6** (N14, O04, O1, P08, R06, R07) |
| ⛔ OUT-OF-SCOPE (admin/Playwright) | **11** (N06, P01–P03, P05–P07, Q18–Q20, R09) |
| ⏭️ DEFERRED | **9** (O07, Q05, Q10/Q11/Q13/Q14/Q15/Q16/Q17) |
| ✅ RESOLVED (Rev 3 re-verify) | **1** |

**Executed (evidence-backed verdict): 37** definite outcomes (27 PASS + 2 FAIL + 2 BLOCKED + 6 PARTIAL).

---

## 3. Perceived load-time table

All transitions measured from the tap → rendered-UI-ready (per §5.7). Simulator is a dev-build; every transition below met the <3s ideal threshold; no slow screens flagged.

| Screen / transition | Elapsed |
|---|---|
| Deep link → Item Detail (fresh listing) | ~0.8s |
| Item Detail → Make Offer | ~0.7s |
| Send Offer → Disclaimer modal | ~0.6s |
| Accept disclaimer → trade initiated (DB write) | ~1.1s |
| Seller Review Offer → Accept confirm modal | ~0.6s |
| Accept → in_progress + "Offer Accepted" alert | ~1.0s |
| Trade timeline → cancel-reason modal | ~0.7s |
| Cancel confirm → "Trade Cancelled" alert | ~0.9s |
| My Listings (252 items FlatList) initial render | ~1.6s |
| Landing after logout | ~1.2s |

**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the <3s ideal threshold.

---

## 4. Cross-cutting UX findings

1. **P1 — Global tax toggle ignored (O03/P04).** Disabling `sales_tax_enabled` does not remove Sales Tax from offers. Root cause confirmed in source: `calculate_tax` selects the flag but never conditions on it; write path also ignores it. This is the highest-severity finding of the run.
2. **P2 — Tax engine uses category tax RULES (6.99% v3), not node rate (6.35%).** Guide numbers are stale. New offers are governed by `tax_rules` applied_rule `bc94b4e0`; node-rate edits (P01/P08) do not propagate. Doc drift + config-surface confusion risk.
3. **P3 — Staging in_progress-cancel VOIDS instead of refunding (R05/R06).** Because staging capture is simulated (captured_at null, no stripe_capture_id), cancelling an in_progress trade sets `tax_status=voided` and a synthetic `stripe_refund_id="cancelled_pi_..."` with no `trade_refunds` row. User copy ("Any Swap Points have been refunded…") is fine; the money closure differs from a real refund.
4. **P3 — Bulk listing form not reliably drivable (N05/N13/N14).** ScrollView binary-snapping + publish gating makes per-item title/condition/price entry flaky. Recommend a `dev-fill-bulk-items` QA fixture.
5. **P4 — Native alerts are AX-suppressed** ("Offer Accepted!", "Offer Declined", "Trade Cancelled" appear as native alerts with an empty app AX tree). Detected via OCR. Not a defect, but a QA-tooling note: the simulator's native alert OK button position is estimated.

## 5. Cross-cutting design-system compliance

- Cancellation-reason modals (buyer + seller variants), Accept/Decline confirm modals, and the disclaimer modal all use the design-system primary accent (#5DBB8E) for affirmative actions and the correct destructive style for Cancel-trade confirmation. **No deviations found** on the screens/mods reviewed.
- "Let's Adjust Your Price" modal: primary CTA green #5DBB8E (94.87% measured), title/body copy per DS. **No deviations.**
- Review stars + "Anonymous User" profile rendering follow the DS palette. **No deviations.**

---

## 6. Recommended follow-ups (DEV-side, separate tasks — not applied in-run)

1. **Fix (P1):** `calculate_tax` / `apply_tax_to_trade` must short-circuit to $0 tax when `sales_tax_enabled=false`. Verify O03/P04 after fix.
2. **Fix (P2/doc drift):** Update TradeFlowV2 Group O/P guide numbers to the live rule rate (6.99%) and document that category tax RULES override node rates (P01/P08 expectation).
3. **Instrumentation (P3):** Add `dev-fill-bulk-items` fixture to `BulkListingCreateScreen` to unblock N05/N13/N14 bulk legs.
4. **Locator gap (from N11):** Pencil/trash/dots icons on My Listings cards have no AX/testID (only rendered for `available` items). Recommend adding `testID` per action.
5. **Cleanup note:** QA fixture item `755e1774` soft-deleted; completed trade `6cbe3c5d` + review `20c09442` left as intentional Q-group evidence on test-seller profile (removable by admin if desired).

---

## 7. App State Left Behind (cleanup performed)

- **Config reverted:** `min_listing_price` 5 → **0** (category `fees`, type `number`, DB read-back verified); `sales_tax_enabled` already **true** (read-back verified).
- **Fixtures:** item `755e1774` (QA Dev Fixture Item) **soft-deleted** (`status='deleted'`, read-back verified). No trade references.
- **Session trades all resolved (no residue):** `85c42fbf` (R01 cancelled), `2be6c3e8` (R05 cancelled), `6aebf360` (R02 cancelled), `8dbefa7c` (R03 cancelled). Listings `623a2807` and `0ce8434f` restored to `available`.
- **Intentional QA evidence retained:** completed trade `6cbe3c5d` + anonymous review `20c09442` (5★) on test-seller profile (Q-group evidence; removable by admin).
- **Client-side QA toggles cleared:** final logout to **Landing** (verified — Get Started / Log In visible, no residual modals).

---

## 8. Friction vs. operating rules (§9 log)

- ItemCreate footer overlap (dev fixtures behind sticky Submit) — worked around with content scroll (~77pt).
- FlatList tree coords are logical not rendered (My Listings ~274pt offset) — OCR/pixel-verified before taps.
- Native alerts suppress the app AX tree — resolved via OCR + estimated OK position (R2 re-verified with screenshots).
- Send-offer CTAs overlap the tab-bar band (R22/R31) — scrolled up to clear before tapping every offer.
- Schema column-name churn (e.g., `offer_accepted_at`, `stripe_payment_intent_status`, `amount_cents`) — used `SELECT *` fallbacks.
- `qa:inspect-screen` requires `--img`, not `--udid` — used `qa:ocr` on saved screenshots.

---

## 📋 QA Session Handoff

**Test Scope:** QA Task 11 — Groups N (N04,N05,N09–N14), O (O01–O08 + O1/O2/O3), P (P01–P08), Q (Q01–Q20), R (R01–R09) + Rev 3 IssueReportModal reason-row AX re-verify (2026-08-30, iOS Simulator iPhone 17 Pro Max, staging `drntwgporzabmxdqykrp`).
**Design-System Compliance:** PASS — no deviations found on any screen/modal/alert reviewed (cancellation modals, accept/decline confirms, disclaimer modal, price-adjustment modal, review UI); affirmative CTAs use #5DBB8E and destructive uses the correct red.
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered within the ideal <3s threshold (0.6–1.6s; My Listings 252-item initial render slowest at ~1.6s). No flags.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Make Offer screen: "Safety & Platform Fee", "Sales Tax", "Total cash" breakdown copy matches DS.
- CONFIRMED — Seller Review Offer: "Cash Amount / Platform Fee / Net Cash Payout" + safety-meetup guidance copy.
- CONFIRMED — Cancellation reason modals (buyer + seller variants): reason lists + "Keep Trade"/"Cancel Trade" destructive pairing.
- CONFIRMED — "Let's Adjust Your Price" modal: title + "$5.00 or more" body + Update Price primary CTA.
- CONFIRMED — Reviews UI: "Rating Required" alert, char-count, "Anonymous User", 4.5/2 reviews, 5→1★ breakdown.
- CONFIRMED — Trade Cancelled / Offer Accepted / Offer Declined alerts: copy clear and consistent.
- CONFIRMED — Trade Timeline Payment Details: "Estimated Sales Tax" buyer-only (no tax row for seller) — matches requirement.
- DEVIATION — None.
**Verdict Summary:** 27 PASS / 2 FAIL / 2 BLOCKED / 0 SKIPPED (plus 6 PARTIAL, 11 OUT-OF-SCOPE, 9 DEFERRED, 1 RESOLVED) — **37 executed with definite evidence-backed verdicts.**
**Critical Findings:**
1. **P1 (O03/P04):** Global tax toggle (`sales_tax_enabled=false`) does NOT zero tax — `calculate_tax` reads the flag but never conditions on it. Real bug, both write + read paths.
2. **P2 (P01/P08/O04):** Tax engine uses category tax RULES (6.99% v3 `bc94b4e0`) which override node rate (6.35%); guide numbers are stale; node-rate edits don't propagate to new offers.
3. **P3 (R05/R06):** Staging in_progress-cancel VOIDS tax/auth instead of issuing a real refund (capture simulated); no `trade_refunds` row; synthetic `stripe_refund_id="cancelled_pi_..."`.
4. **P3 (N05/N13/N14):** Bulk listing per-item form not reliably drivable; recommend `dev-fill-bulk-items` fixture.
5. **P4 (N11):** My Listings action icons (pencil/trash/dots) lack AX/testID; only render for `available` items.
**App State Left Behind:** Clean — `min_listing_price` reverted to 0 (fees/number, read-back); `sales_tax_enabled` true; fixture item `755e1774` soft-deleted; all session trades cancelled; app logged out to Landing (client toggles cleared). Intentional Q-group evidence retained: completed trade `6cbe3c5d` + review `20c09442` (5★ anonymous) on test-seller profile (admin-removable).
**Why It Matters:** Proves the refund/cancellation state machine works end-to-end on mobile (R01–R05/R08: cancel/decline/expiry all restore the listing and never leave money or payouts behind), the reviews & ratings surface is correct and anonymous-safe (Q01–Q09/Q12), and surfaces one genuine money-affecting bug (global tax toggle ignored) plus a tax-engine doc-drift issue that admins should understand before touching node rates.
**How to Verify/Reproduce:** All screenshots in `e2e-test-results/qa-task11-nopqr-2026-08-30/screenshots/`. O03: set `sales_tax_enabled=false` (admin config), relaunch, build a $30 offer → Sales Tax still $2.10. R03: `UPDATE trades SET offer_expires_at=now()-'1 second'` on a pending offer then `SELECT rpc_process_expired_offers()`. R05: accept an offer to in_progress, seller-cancel, then check `seller_payouts` (empty) + `tax_records.tax_status='voided'`.
**Known Gaps / Not Tested:** Bulk per-item legs (N05/N13/N14 — driving-limited; N06 auto-pause); all admin-web surfaces (P02/P03/P05–P07, Q18–Q20, R09, N06, P01/P08 admin UI); time-window/multi-account review cases (Q05/Q10/Q11/Q13–Q17); SP-using trade for R01/R07 SP-restoration leg (all cash offers); R03 competing-offers secondary leg (single pending offer); O07 (guide ⏭️); O04 node-toggle effect (rule override).
**What Needs To Be Fixed Next:**
1. Fix `calculate_tax`/`apply_tax_to_trade` to zero tax when `sales_tax_enabled=false` (O03/P04).
2. Update TradeFlowV2 Group O/P guide tax figures to live rule rate 6.99% and document rule-over-node precedence (P01/P08 doc drift).
3. Add `dev-fill-bulk-items` fixture to unblock N05/N13/N14 bulk legs.
4. Add `testID`s to My Listings action icons (pencil/trash/dots) to close the N11 locator gap.
**UX Enhancement Ideas (optional, not defects):**
- On the buyer offer confirmation, the disclaimer modal's Accept button sits at the very bottom of the sheet — consider a fixed, always-in-view footer so it never requires a scroll on smaller devices.
- On My Listings, a PENDING item shows no actions at all — consider an explicit "pending" status hint row (e.g., "Awaiting approval") so sellers understand why they can't edit/delete yet.
- In the seller Review Offer screen, the buyer's payment method is not shown — consider surfacing "Buyer pays via •••• 4444 (authorized)" to reduce seller uncertainty before accepting.
**Suggested Next Session:** Execute the remaining time-window/multi-account Q cases (Q05/Q10/Q11/Q13–Q17) using an aged-completed trade fixture, and add an SP-using trade to complete R01/R07 SP-restoration and R03 competing-offers legs.
**Suggested to Improve Agent Rules:** None — the playbook's R22/R31 (tab-band), R30 (disclaimer), R2 (keyboard re-verify), and OCR-first native-alert handling all held up; the only recurring cost was native-alert OK-button position estimation, which could be added to the playbook as a known pattern (alert centered ≈ y530 on iPhone 17 Pro Max).
