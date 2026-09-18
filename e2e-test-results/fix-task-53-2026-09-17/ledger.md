# FIX-Task-53 — ledger (concise)

Round: 2026-09-17 · Source round: QA SUB Android R8 final closing (2026-09-17)
Tier 0: typecheck PASS · lint 0 errors · 5 suites / 89 tests PASS · full suite 3945 PASS / 2 ENV-FAIL

| # | Item | Sev | Disposition | Evidence |
|---|---|---|---|---|
| 1 | Grace user cannot spend SP (`TradeOfferScreen` subscriber check) | MED-HIGH | **FIXED + device-verified (iOS)** | `F53-01..04`; trade `0ba80809-…`; "Swap Points Used: 5 SP" |
| 2 | Same-class fee-tier bug at `TradeInitiationScreen:436` | MED | **Premise disproven** — orphan screen; predicates applied for consistency; orphan documented | §0 of report |
| 3 | Audit remaining `'grace'`-only checks | Audit | **COMPLETE** — `AuthContext:813` already correct; `useAuth:64` + 5 more sites fixed; shared predicates added | `useAuth.test.ts` 5 tests |
| 4 | G01 documented success copy = dead code | MED | **FIXED** — `result.created` tested before `resumingOnboarding`; logic extracted + 7 tests | `payoutConnectCopy.test.ts`; guide G01 🔧 note |
| 5 | Withdraw guard reuses "No Method" wording | LOW-MED | **FIXED** — unverified variant (title/body/CTA branched) + 3 tests | ⚠️ device leg owed |
| 6 | `qa:set-sp-balance` false-negative verify | Tooling | **FIXED + proven live** | `✅ VERIFIED: available=20 … state=grace_period` |
| 7 | `no-method-cancel-btn` Android AX exposure | Locator | **RE-CLOSED AS NON-GAP** (stale-bundle artifact) | `F53-05`; iOS fresh bundle exposes both buttons |
| 8 | `STRIPE_WEBHOOK_SECRET` | Enablement | **CONFIRMED BLOCKED** — absent from both `.env` files (0 occurrences) | SUB-TC-L05 positive leg stays BLOCKED |
| 9 | No upsell beneath grace banner | UX | **SATISFIED by item 1** (no code change) | `F53-02` — upsell card absent |
| 10 | Unified resume-or-add entry point | UX | **DONE** | 1 test; guide G11/H04 |
| 11 | "Cancelled At" reads as contradiction | UX | **DONE** — `Cancelled At (historical)` label | ⚠️ no test + device leg owed |
| 12 | Item Detail Seller Info below fold | UX | **DEFERRED** (owner design decision) | — |

## Findings
- **F1 [OPEN — owner decision, money]** Live buyer-fee resolver charged `test-grace` (`grace_period`) the **member** fee **$1.49**, contradicting `20260916000121_tiered_buyer_fee_engine.sql:122` ("trial or active ONLY") and `subscription.ts`'s `$2.99 for grace_period` doc/test. Fallback left behaviour-preserving; 5 comments corrected to state only verified facts; discrepancy reported rather than guessed.
- **F2 [INFO]** Tracker file-header `(newest)` marker is 2 rounds stale (pre-existing, not fixed — scope).
- **F3 [INFO, pre-existing]** `verify:guides` exit 1 on 2 pre-existing TRD tracker contradictions (S15, T03); E04 index/body divergence verified **not** introduced here; ADM duplicate headings = documented baseline.

## Environment
- **Android leg BLOCKED:** dev client wedged at "Bundling 100% / Loading from 10.0.2.2:8081…", no JS evaluation, no `ReactNativeJS` logs, ~1 s frame draws; two `npm run dev:android` attempts OOM-killed (exit 137). Harness/dev-tooling stall (R102 discriminator) → pivoted to iOS, which passed end-to-end. Android leg **owed, not failed**.
- **No Supabase MCP this session** → trade-row DB read-back **owed**; SP spend evidenced by the app's persisted timeline + wallet read-back only.
- Full-suite 2 failures: `referral-analytics-admin.e2e.ts` `57014 statement timeout` (live staging DB) — environmental.
- `.github/agents/QA-Test-Agent.agent.md` + `.github/instructions/QA-Test-Agent.instructions.md` show modified in `git status` — **pre-existing uncommitted changes, NOT from this task**.

## Tracker
Edited **in place** (never regenerated — §5.54 R52 warning): Round 9 note + Notes appends to SUB-TC-D01/E04/G01/G11/H04. **No flips.** Counts consistent: 100 · **79 PASS / 1 PARTIAL / 2 OPEN** / 0 DRIFT / 0 SKIP / 15 RETIRED / 2 N/A.

## State left behind
`test-grace` 15 available SP (5 reserved by open offer `0ba80809-…`; do NOT zero it while reserved) · new Stripe customer `cus_VHK8BgDjkHjQ9k` / PM `pm_1UGlUC4I6kCJlvXoM77Rr38u` · `qa-payout-seller` methods **RESTORED** (`acct_1UGm4A3qQXHDi0B9`) · iOS sim logged in as `qa-payout-seller` · Metro on :8081.
