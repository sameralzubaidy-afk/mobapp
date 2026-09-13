# Ledger — QA Task (Group L final legs + M/N/S/T remainder + Round 3), 2026-09-13

**Run folder:** `e2e-test-results/qa-groupl-final-mnst-round3-2026-09-13/`
**HEAD:** `94c8fb79` · **Device:** Android `Medium_Phone_API_36.1` (`emulator-5554`) · iOS booted, **not driven** (R80)
**Accounting:** R71-fallback (session transcript not mineable for this agent) — **manual tally**, desk work isolated from device-execution calls.

## Device-execution call tally (estimate)

| Phase | Verdict items | Appx. device/tool calls |
|---|---|---|
| Session recon + env busy check | — (desk/prep) | ~6 |
| **P1** — L08 + O2-C09 + L02 | 3 | ~48 |
| App-wedge diagnosis + R92 cold relaunch | — (recovery, no verdict) | ~14 |
| **P2/P3** — S/M/V/X/U/Y/T sweep | ~30 | ~40 |
| **Totals** | **~33 verdict items** | **~108 device/tool calls** |

**Blended ≈ 3.3 calls/verdict** (device-only ≈ 3.3; the ~20 desk/prep calls excluded).
Best-blended of the recent rounds (43c baseline 9.6; the 2026-09-12 rounds 10.8 / 6.3). The gain came
from (a) reusing the natural post-P1 state (the 4 cart items going `sold` gave M13 + S07 for free),
(b) the 4-item bundle serving L08 → L02 → O2-C09 in one flow, and (c) `view_image` at full resolution
instead of a fresh device drive to settle the U01 back-button question.

## Fixture / DB writes (all declared; 4 total)

| # | Operation | Purpose | Reversible |
|---|---|---|---|
| 1 | `qa:create-bundle-fixture --count 4` (service role) | L02/L08 bundle | n/a (test data) |
| 2 | `qa:ef-repro --ef create-trade-offer --items <4>` | real PIs for the bundle | n/a |
| 3 | `UPDATE trades SET bundle_id = 'b12351bc…'` on 4 pending rows | match the app's checkout shape (EF omitted it) — see report F8 | yes |
| 4 | `UPDATE trades SET auto_complete_at = now() + interval '5 seconds'` on `472ef43a` | O2-C09 fast clock (guide-prescribed recipe) | no (trade completed) |

Plus one non-mutating EF invocation: `POST process-auto-complete` (`{"batch_size":100}`) — the cron path.

**No `admin_config` writes. No admin-portal mutations. No browser `page.route` stubs registered.
No fixture resets were run mid-session (the bundle was built once and never reset).**

## Verdict register

| TC-ID | Verdict | Platform | Depth |
|---|---|---|---|
| TRD-TC-L02 | ✅ PASS | Android | full 3-step, DB-verified |
| TRD-TC-L08 | ✅ PASS | Android | full, DB-verified |
| TRD-TC-O2-C09 | ✅ PASS | backend/EF | full, DB-verified |
| TRD-TC-M03 · M07 · M16 · M18 | ✅ PASS | Android | standard |
| TRD-TC-M13 | 🟡 PARTIAL | Android | flag observed; realtime/24h legs not driven |
| TRD-TC-S01 · S02 · S04 · S05 · S07 · S14 · S17 · S21 | ✅ PASS | Android | standard (S17 DB-reconciled) |
| TRD-TC-S20 | 🟡 PARTIAL | Android | dismiss affordance present; dismissal not driven |
| TRD-TC-T01 | ✅ PASS | Android | standard |
| TRD-TC-S09 · S10 | ✅ PASS | Android | standard |
| TRD-TC-U01 · U02 · U05 | ✅ PASS | Android | device + source corroboration |
| TRD-TC-V01 · V02 · V05 · V06 · V07 · V09 · V10 · V11 | ✅ PASS | Android | standard |
| TRD-TC-X03 · X04 · X05 · X07 · X09 · X10 | ✅ PASS | Android | standard |
| TRD-TC-Y01 · Y04 | ✅ PASS | Android | standard |
| TRD-TC-Y09 | 🟡 PARTIAL | Android | card + CTA present; toggle not driven |

**Not run (zero verdicts):** Group N remainder (N05/N08/N11–N13) · Group T remainder (T03/T12–T14) ·
S03/S06/S08–S13/S15/S16/S18/S19/S22–S24 · M05/M06/M14/M15/M19/M20 · V03/V04/V08/V12/V13/V14 ·
X01/X02/X08/X16 · Y02/Y03/Y05–Y08 · **all N2 (C01–C10)** · W (skipped by instruction).

## Friction log (fed to the report's "Suggested to Improve Agent Rules")

1. **Warm `qa-login-as` wedge** (~12 calls): app stuck on perpetual spinners + `[trade] Error counting
   active trades: {"message":""}`; `qa-logout` alone did not clear it; **force-stop + cold relaunch (R92)**
   fixed it. The cold dev-client start itself is ~4 min (~10 polls).
2. **Two `qa-login-as` fires were needed** — the first did not switch the persona while the app was deep
   in a navigation stack (the handler's nav-reset ran but the session stayed on the previous user).
3. **Compressed-thumbnail misread**: the Trade Basket's top-left rendered as a "chevron" in the
   downscaled screenshot but is an **empty spacer** at full resolution. Resolved with `view_image`
   (1 call) instead of a device round trip — and it prevented a false U01 finding.
4. **`qa:ax-tree` cannot parse the mobile-mcp session-resource file** (`ERROR: could not parse element
   tree`) — it expects JSON, the tool writes a rendered text tree. `grep -E` on the resource file is the
   working path (already documented for this case; re-confirmed).
5. **`qa:ef-repro --items a,b,c,d` creates N single-slot offers** because the EF batch path only stamps
   `bundle_id` when the caller passes it (report F8).
6. **Sold-items-in-cart is a usable free fixture**: completing the bundle left the 4 cart rows `active`
   against `sold` listings, which yielded M13's unavailable-flagging + S07's bundle CTA with **zero**
   setup calls — worth remembering as a deliberate technique (extends §5.33 "repurpose incidental state").
7. **Item Detail's Contact Seller / View Profile have no testIDs** (ViewGroup labels only) — locator gap F7.
