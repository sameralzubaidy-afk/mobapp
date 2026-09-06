# QA Task 34 — Payout E2E ledger

Run: `e2e-test-results/qa-task34-payout-e2e-2026-09-05/` · 2026-09-05/06 · iPhone 17 Pro Max sim · qa-payout-seller + test-seller

**Round question: "can a seller withdraw money, and do the failure paths work?" → YES. Positive path verified end-to-end (real seller_payouts row, correct balance decrement + fee, mobile reflection); all four failure guards verified.**

| TC-ID | Verdict | Evidence (on-device + DB) |
|---|---|---|
| SUB-TC-H03 | ✅ PASS | Real withdrawal: payout `899e70cf` (gross 500/fee 26/net 474/processing/stripe), available 500→0, hero+history refresh, alert copy exact |
| SUB-TC-H01 | ✅ PASS | "No Balance / You have no available balance to withdraw", no modal, no payout |
| SUB-TC-H04 | ✅ PASS | No-method → Payment Method Required modal; Cancel → 0 payouts, balance unchanged |
| SUB-TC-G11 | ✅ PASS | NoMethodModal copy exact (Payment Method Required / add-and-verify first) + Cancel clean |
| SUB-TC-G05 | ✅ PASS | Unverified auto-primary → WithdrawModal → RPC reject "Primary payout method is not verified", 0 rows, balance unchanged (guide NoMethodModal phrasing = doc-drift) |
| SUB-TC-H06 | ✅ PASS | $1.50 < live 200 floor → "Minimum withdrawal amount is $2.00", 0 rows, balance unchanged |
| SUB-TC-H07 | ✅ PASS | Config 200→0 (scope-write) → $1.50 withdrawal succeeds (payout `a5352ce1`), reverted to 200 + verified |
| SUB-TC-F06 | ✅ PASS | stage-trade → pending payout `b525951a` (+2d) → hero Pending $20.00 / Available $0.00; release-transition leg not driven (synthetic-dispatch boundary) |
| SUB-TC-G04 | ✅ PASS | set-primary moved highlight to B (DB is_primary=true); delete non-primary A with confirmation (DB: B only) |
| SUB-TC-G09 | ✅ PASS | "Cannot Set as Primary" + exact status copy on unverified radio |
| SUB-TC-G06 | 🟡 PARTIAL | requires_action row `39b7e451` renders "Action Required"; no Set-Up-Payout-Method CTA on live card (doc-drift to dead SellerEarnings) |
| SUB-TC-F05 | ✅ PASS | "No payouts yet" empty state (clean states) |
| SUB-TC-F07 | ✅ PASS | payout_fetch_failure armed → "Failed to load payout data. Please try again."; disarmed → recovery |
| SUB-TC-K02 | ✅ PASS | empty "No billing history yet." + error "Failed to load billing history"+Retry + recovery |
| SUB-TC-D05 | ✅ PASS (cross-ref) | DT118 fix in place (EF step-9 service-role unfreeze, HEAD 5ef735fa, deployed parity); fresh re-drive = real-Stripe disposable session |

**DT118 item re-verifies:** Item 2 (test-seller hero $140.40/$442.60/$583/25 trades — DB-verified) · Items 5/9 (provider-attributed fee labels + notes) · Item 4 (Load More testID + pill-clear) · Item 7 (F07/K02 error/Retry) · Item 8 (ContinueKidsClub active landing + Manage Kids Club+ nav) — all PASS.

**Findings:** **D1 (owner-flagged, HIGH) — ContinueKidsClub upsell branch off-brand**: price card + "Join Kids Club+ on the web" CTA + outline use `#4A7C59` (non-canonical dark green) — should be `#5DBB8E`; greys `#4D4D4D`/`#808080` → `#6B6B6B`/`#999999` (`ContinueKidsClubScreen.tsx`; the same file's active branch is already on-brand — internal inconsistency; fix recommended as a dev follow-up, QA execution-only). G06 CTA doc-drift + UX gap (no in-row action for requires_action) · hero Pending gross-vs-history-net discrepancy (F06 note) · H01/G05 brief-vs-guide doc-drift (dead amount-entry model) · LOW copy "Primary payout method is not verified" · test-seller sub = grace_period (active-member surfaces need an active persona) · flow-registry DT118 entries not updated (housekeeping).

**Cleanup:** qa-payout-seller reset to baseline (0/0/0/0), config reverted to 200 (verified), payout_fetch_failure disarmed, logged out, app on Landing. No Stripe residue.
