# QA Task 35 ledger — DT-119 every-branch live verification + SUB follow-ups (2026-09-05)

Round question: "Does R62a (audit EVERY rendered branch) work, and are all DT-119 fixes live?" → YES. Every on-device-reachable branch of ContinueKidsClub + every reachable state of the 7 other fixed screens audited clean (0 off-brand #4A7C59 anywhere); the D1 upsell-branch fix, G06 Set-Up-Payout-Method CTA, G05 friendly copy, F08/G10 pagination, and Batch E footnotes all verified live.

| Leg | Verdict | Top finding |
|---|---|---|
| A active | ✅ PASS | active branch on-brand (#E8F5F0/#5DBB8E pill + Manage btn) |
| A free | ✅ PASS | D1 FIXED — positive green pill + #5DBB8E card/CTA, 0% #4A7C59 |
| A grace | ✅ PASS | positive pill (same branch as free) |
| A expired | ✅ PASS | positive pill (deep link bypasses gate) |
| A grace_period | ✅ PASS | positive pill (test-seller) |
| A trial≤7 / trial>7 | 🟡 source-audited | no trial persona on staging (fixture gap); urgency pill canonical #FFF3E0/#FFA726 |
| B ManageKidsClub active | ✅ PASS | Status Active/Next Billing; full-frame clean |
| B ManageKidsClub expired | ✅ PASS | badge #6B6B6B fill (DT-119); free state = no-active-sub early-return (badge_free dead note) |
| B SubscriptionStatus | ✅ PASS | EXPIRED #999999 on-device (staged notif, removed) |
| B PaymentMethods | ✅ PASS | empty body #6B6B6B + #5DBB8E primary, no legacy |
| B TransactionHistory | ✅ PASS | empty #6B6B6B; populated dates #999999 + FAILED caption |
| B LinkedAccounts | ✅ PASS | icons/buttons #5DBB8E, no legacy |
| B TradeTimeline | ✅ PASS | completed+cancelled clean; bundleItemPrice #6B6B6B source-verified (in-progress bundle list not fixture-available) |
| B PayoutSettings pending | ✅ PASS | #FFA726 (not #F59E0B) |
| C requires_action CTA | ✅ PASS | G06 CLOSED — Set Up Payout Method CTA on card → AddPayoutMethodModal |
| D friendly copy | ✅ PASS | "Your payout method isn't verified yet…" (not raw RPC); 0 payout rows, balance unchanged |
| E footnotes | ✅ PASS | balance-fee-note + payout-history-fee-note on-device both sellers |
| F F08/G10 | ✅ PASS | 25-payout seller Load More 5→10→15 clean |
| F D05 | 🟡 not driven | dedicated R41 real-Stripe disposable session owed; positive+negative legs named |
| F G01 | 🟡 not driven | pending real-account provisioning |

Roll-up: 13 PASS / 2 PARTIAL (fixture-gated) / 0 FAIL / 0 BLOCKED.

Cleanup (DB-verified): qa-payout-seller reset to 0/0/0/0 (active sub intact, persona kept); test-expired staged notification removed; test-seller untouched ($140.40/$442.60/$583.00, 25 payouts); no admin_config writes; no Stripe objects; logged out at Landing.

Tracker: QA-TESTCASE-STATUS-2026-09-03.md — SUB F08/G10/G06 → PASS; G05/F06 notes refreshed; N06 note updated; SUB PASS 69→72, PARTIAL 5→2.
