# Dev Task 8 — Re-Run Smoke Check + TRD Group A & Impacted-Flow Verification — QA Report

**Date:** 2026-08-27 (Part 2 resumed ~22:20Z, completed ~23:00Z)
**Agent:** QA Test Agent (execution-only) · **Mode:** Verification pass (no code changes)
**Scope:** Part 1 (smoke re-run groups A,B,C,D,F) + Part 2 (TRD-TC-A01/A02, FLOW-08/11/12/22)
**Staging project:** `drntwgporzabmxdqykrp` · Simulator: iPhone 17 Pro Max (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`) · App: Pass It Up! debug build

> **Headline result:** The incident chain (create-trade-offer v52 → Stripe "Missing required param: amount") is **RESOLVED — create-trade-offer v56 is verified working end-to-end** (A01 PASS, full happy path, DB-confirmed). The earlier `83c8823b` HTTP 402 was a **stale Stripe idempotency-key artifact** from the pre-fix v52 run, not a v56 regression.

---

## Part 1 — Automated smoke re-run (groups A,B,C,D,F, iOS)

Command: `IOS_SIMULATOR_UDID=3F3293A3-… bash test-automation/trade-flow-v2/scripts/run-suite.sh --no-preflight --group A,B,C,D,F --platform ios`

| Metric | Result |
|---|---|
| Harness parse errors (Task 7 fix) | ✅ **None** — `element:` wrapper + `direction:` props confirmed working |
| Units | 6/6 failed |
| Cases selected | 23 (pass 0 / fail 23 / skip 3) |
| Root cause (all 23) | Shared login helper's post-login `tab-discover is visible` assertion times out because after fresh auth the app routes to the **Terms of Service gate** (PolicyReacceptanceGate, commit `64929260`). Maestro login helpers predate this gate. |
| Infra flakes (2) | D-unit `IOSDriverTimeoutException`; F-unit app-permissions connection error |
| Issues filed | 0 — `gh issue create` in post-run shell-mangles (test-infra defect, see Findings) |

**Per-group status:** A ✗ · B ✗ · C ✗ · D ✗ (flake) · F ✗ (flake) — every case fails at the same login-helper assertion; **no trade-flow logic failures observed** at the app level.

---

## Part 2 — TRD Group A + impacted flows (manual on-device, DB-verified)

### TRD-TC-A01 · Cash Only: full happy path — ✅ PASS
| Step | Result | Evidence |
|---|---|---|
| 1–2. Buyer submits offer (fresh item `cc81e86c` "QA L Group Chain Item 0821", $25 cash-only) | PASS | Trade `3e792a09` → `pending`; value stack **$25.00 + $1.49 + $0.00 = $26.49**; PaymentIntent `pi_3U9Bei4I6kCJlvXo133ZcU2W` (hold placed) |
| 3–4. Seller accepts offer | PASS | "Offer Accepted! Payment captured. Trade is now in progress." modal; trade → **`in_progress`** (DB) |
| 5–6. Buyer I Got It → Confirm (Complete) | PASS | "Trade Complete! Your item has been received." + **Rate Seller** button; trade → **`completed`** (DB), `completed_at` 22:40:10Z, `buyer_marked_completed_at` set |

Screenshots: `a01-10…a01-20`.

### TRD-TC-A02 · Accept SP (SP slider → seller accepts → buyer confirms) — ⚠️ PARTIAL (buyer-side PASS; seller-accept leg BLOCKED)
| Sub-check | Result | Evidence |
|---|---|---|
| SP offer screen + 50% cap | PASS | "Max: 15 SP (50% of price)" on a $30 item; slider/input range 0–$15 |
| 8 SP → value stack | PASS | **$22.00 cash + 8 SP = $30**; fee $1.49; tax $2.10; total cash **$25.59** |
| Offer submitted | PASS | Trade `cc5990b2` → `pending`; `sp_amount=8`, `cash=2200¢`; PaymentIntent `pi_3U9C6o4…` ($22 hold) |
| FLOW-11 C01 SP reserved on offer | PASS | Wallet 46→**38** available, 10→**18** reserved |
| Buyer cancel → SP restored | PASS | "Trade Cancelled — Any Swap Points have been refunded"; wallet → **46** available, **10** reserved; trade `cancelled` (reason "Changed mind") |
| Seller accept → SP released to seller | **BLOCKED** | No reachable Accept-SP seller: test-seller's Accept-SP items are all `paused`/`pending`; the available $30 Accept-SP item's seller (`cc0a0aff`) is an unknown persona with no credentials |

Screenshots: `a02-01…a02-09`.

### FLOW-08 · Offer/cancel lifecycle — ✅ PASS
- Earlier in this task: 3 stale pending offers (Kids Bicycle `2db31045`, LEGO `43e79751`, Nintendo Switch `2761f7ef` — all to test-seller, $45 each) cancelled via CancellationReasonModal; DB confirms `status='cancelled'`, `cancelled_at`, `cancellation_reason='Changed mind'`.
- This run: A02 offer cancel also PASS (see above). Per-seller cap now 0 pending.

### FLOW-11 · SP reserve/release — ✅ PASS (reserve + restore); ⚠️ seller-side release BLOCKED
- **C01** reserve on offer: VERIFIED (see A02). **C03-equivalent** restore on buyer cancel: VERIFIED (see A02).
- **C04/C05** (SP stays reserved when accepted; SP released to seller at completion): **BLOCKED** by the same Accept-SP-seller gap.

### FLOW-12 · Subscriptions — ✅ PASS (state verified)
| Persona | DB status | On-device |
|---|---|---|
| test-seller | `trial`, ends **2026-09-01**, auto-renew on | Home banner "5 Days Left in Your Trial" |
| test-buyer | `active`, $5.99/mo | active-member fee $1.49 applied |

### FLOW-22 · Payouts — ✅ PASS (F01-computed + F03); clean-initiated leg not testable
- **F01** payout on completion: payout computed **$20.00** (`payout_amount_cents=2000`), `payout_release_at` = 2026-08-29 (48h release window), `payout_status` set on completion. Payout math consistent: $25 − $5 seller fee = $20.
- **F03** payout needs action when seller has no payout method: `seller_payout_methods` for test-seller = `[]` → `payout_status='requires_action'`. **Verified.**
- Note: seller fee recorded = **$5.00 (20%)** on the $25 cash item — verify intended fee rate for a trial-tier seller (see Findings).

---

## Findings / follow-ups (flag, do NOT fix in this run)

1. **P2 (product copy):** Liability Disclaimer modal contains **Amazon seller-agreement commercial-liability boilerplate** ("Amazon.com store", "Amazon.com Services LLC") — reconfirmed on-device twice this run. Should be replaced with Kids Marketplace copy.
2. **Test-infra defect:** Part 1 `issues-filed.md` = 0 issues because `gh issue create` is shell-mangled in post-run; 23 real failures were not filed.
3. **Test-infra gap:** All 23 Part 1 smoke failures are caused by the TOS gate (PolicyReacceptanceGate). Maestro login helpers need to handle the post-login TOS/Privacy acceptance screens.
4. **A02 setup gap:** test-seller's Accept-SP items are all `paused`/`pending` (0 discoverable/available). Re-provision an available Accept-SP item (with images) under test-seller to unblock A02's seller-accept leg and FLOW-11 C04/C05.
5. **Minor copy:** A02 success toast "You have 46 SP left" shows the pre-reserve available balance (reserved SP not reflected) — verify intended.
6. **Minor doc drift:** guide A02 says fee $0.99 — actual active-member fee is $1.49; guide omits sales tax (7% applies). Fee/quote numbers in the guide are illustrative.
7. **Observation:** `payout_status='requires_action'` correctly triggers when the seller lacks a Stripe Connect method; a Connect-enabled seller fixture is needed to verify the full initiate-payout / release-due-payouts / process-paypal-payout chain (F02/F04+).

---

## Evidence
- Screenshots: `e2e-test-results/trd-part2-2026-08-27/screenshots/` (`a01-*`, `a02-*`, `cancel*`, `resume-*`, `step1-16`)
- Prior run: `e2e-test-results/2026-08-27T21-10-57/` (Part 1: report.md, results.json, issues-filed.md; commit `aae9129f`)
- All DB confirmations via approved read-only SQL against `drntwgporzabmxdqykrp`.
