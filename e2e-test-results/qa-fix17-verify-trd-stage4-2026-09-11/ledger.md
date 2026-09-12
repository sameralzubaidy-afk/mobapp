# Ledger — qa-fix17-verify-trd-stage4-2026-09-11

## Session shape
| Field | Value |
|---|---|
| Device | Android `Medium_Phone_API_36.1` (emulator-5554, Android 16). iOS `iPhone 17 Pro Max` booted, **not driven**. |
| App bundle | Dev-client via Metro `:8081` (**single instance enforced** — `metro:kill` removed 2 strays first) |
| Personas | `test-buyer` (49243010…), `test-seller-3` (a1234567-…0012) |
| Admin portal | **not used** this round |
| Fixtures | QA bundle cart `73d5eb11-…` (3 × $25 `accept_sp`, seller test-seller-3); `qa:invalidate-payment-method` (R93) arm→restore; pending trade `91a76811…` cancelled |
| Config writes | **none** (`admin_config` read-only) |
| Code writes | **none** (execution-only) |

## Call ledger (R71 **fallback — manual tally**)
> The chat transcript for this session was **not mined** (`qa:mine-call-ledger` was not run; the run is a single
> agent turn with no separate debug-log execution stream available to this agent). Per R71-fallback the figures
> below are an **explicit manual tally**, labeled as such — **not** a mined count — with desk-work isolated from
> device-execution calls so the per-verdict comparison stays apples-to-apples.

| Phase | Desk / recon calls | Device-execution calls | Verdict items |
|---|---:|---:|---:|
| Recon (playbook + memory + prior report + guide/source reads) | ~14 | 0 | — |
| Environment (R29 checks, Metro kill/start, device enumeration) | 2 | 3 | — |
| **Phase 1** (13 checks: 9 on-device, 4 source/DB) | ~12 | ~38 | 13 |
| **Phase 2a** (buyer harvest flow + 8 case verdicts + by-products) | ~4 | ~52 | 8 |
| Report / tracker / handoff authoring | ~6 | 0 | — |
| **Total** | **~38** | **~93** | **21** |

**≈ 131 tool executions / ~21 verdict-items ≈ 6.2 calls per verdict** (desk + device blended).
Device-only rate ≈ **93 / 21 ≈ 4.4 calls per verdict** — **below** the 43c 9.6 baseline and the R78 target of 6–7,
consistent with this round being a verification + single-flow harvest rather than a fresh multi-group drive.
Waste attributable to friction (see report §7): **~8 calls** (3 schema surprises + ~5 stale-resource-file greps).

## Per-verdict index
| Verdict item | Where |
|---|---|
| FIX-17 items 0–12 (13) | report §Phase 1 table |
| TRD-TC-L01, L02, L03, L05, L06, L07, L09, R01 | report §Phase 2a table |
| By-products: K04/K05 steps 7–10, M12, T06-family counter, R62b hex sweep | report §Phase 2a + §Phase 2b/2c |

## Phase-2 scope actually driven (R40 explicit)
- **Driven:** buyer-side bundle flow on the QA-owned bundle (checkout → seller accept → buyer confirm) + one buyer cancellation (R01).
- **NOT driven:** every case in Phase 2b (O/O-1/O-2/O-3/P/Q/R02–R05/remaining M-N-S-T/K02/K07–K09) and every case in Phase 2c (U/V/W/X/Y/N2).
