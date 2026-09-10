# QA Task TRD-Expanded — FIX-Task-9 Verify + C06 + D03 + Groups G/H/I — Report

**Run:** 2026-09-09 · `qa-task-trd-expanded-2026-09-09`
**Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Platforms:** iOS Simulator `iPhone 17 Pro Max` + Android emulator `Medium_Phone_API_36.1`
**Repo HEAD:** `808da895` (FIX-Task-9 committed, clean tree) — execution-only, no code changes
**LLM:** DeepSeek V4 Flash · **Agent:** QA Test Agent (execution-only)

---

## 1. Session environment note (Android instability — significant cost driver)

- At session start, host memory was critically low (**~15G/16G used, ~66–124MB free**, load 7.4) — the Android app **ANR'd twice** ("Pass It Up! isn't responding") during first bundle load, then **System UI ANR'd** right after an emulator reboot.
- Recovery: rebooted the emulator, killed the idle Metro 8082 process to free RAM (~1GB+), warmed the Android bundle on Metro 8081, and relaunched → Android became stable for the rest of the session (C06 accept/cancel + item-5 all driven cleanly).
- Both platforms ran the **FIX-Task-9 bundle** (Metro 8081; cold reload per R79-1; fresh-bundle behavior confirmed by the A4 read-back + B06 new copy + clean Trade-Initiated screens).
- iOS = Metro 8081 (localhost connections verified). The iOS app cold-reloaded onto the Landing screen (session cleared), then test-buyer re-logged-in for Part 0.

## 2. Part 0 — FIX-Task-9 Verification

### Item 1 — Stale-pm self-heal (no-relaunch) — ✅ PASS (iOS, user-visible) + unit-test corroboration
- **Baseline:** test-buyer (fresh process, no toggles) submitted a real cash offer on Basketball ($15) → **Trade Initiated** (trade `64dee053`, pending, held with **mastercard 4444** = the then-stored `pm_1UDj9o4`, disclaimer acknowledged). Warm pm cache.
- **Swap:** `qa:ensure-cards --persona test-buyer` created + stored a **fresh MASTERCARD** `pm_1UDkZt4` server-side (old `pm_1UDj9o4` left attached).
- **Without relaunch**, submitted a 2nd real offer on Soccer Ball ($12) → **Trade Initiated** (trade `7d52afad`, pending, mastercard 4444 held, disclaimer acknowledged). **No stale-pm failure, no relaunch.**
- **Honest nuance (R12/source):** A1's rejection→retry branch (`PM_STALE_RETRY_CODES`) requires the EF's `paymentMethods.retrieve()` to THROW on the stale pm — i.e. a genuinely **deleted** pm id. `qa:ensure-cards` does NOT detach/delete the prior card, and the EF **self-heals drift** (auto-attach on `customer:null`; detach+reattach on customer mismatch), so a merely-stale-but-attached card never reaches the client retry. The pre-fix Part-3 "stale pm" symptom is root-caused (R92) to a **stale-armed `card_decline` toggle** (client-side pre-EF failure), not a genuinely-stale pm — and that class is addressed by FIX-Task-9 A4 (verified read-back) + R92 (fresh-process gate). A1's rejection logic is covered by its 2 unit tests (green at HEAD, per the FIX-Task-9 build record: full suite 247 pass/0 fail). **Tooling gap:** no QA path exists to delete a Stripe pm, so a true on-device rejection-branch E2E is not reproducible with current tooling.

### Item 2 — Toggle disarm read-back (A4) — ✅ PASS (iOS; shared JS)
- Arm `card_decline=hold_decline` → dev Alert **"[QA] Toggle Applied — card_decline = hold_decline (verified read-back: hold_decline)"** (AX-exposed, `global-alert-button-0`).
- Disarm `card_decline=none` → **"card_decline = none (verified read-back: none)"**.
- The verified read-back closes the prior blind-deep-link-and-trust gap (R28 sharpening).
- **Android note:** the same deep link via `adb shell am start` did NOT surface the read-back alert on the resumed Android app (delivery quirk this session) — item-2 verdict rests on the iOS on-device proof (shared JS). Toggle disarmed at session end via logout.

### Item 3 — B06 copy — ✅ PASS (iOS)
- Arm `card_decline=hold_decline` → real offer on Roald Dahl ($32) → disclaimer → submit → modal **"Payment Hold Failed — Payment method declined. Please update your card."** (exact new FIX-Task-9 copy; previously "Payment method is invalid or expired"). Guide copy matches. Evidence: `ios-P0-item3-B06-decline-new-copy.png`. Toggle disarmed after.

### Item 4 — iOS LogBox fix (cap rejection) — ✅ PASS (iOS)
- Seeded 3 pending offers toward test-seller (Basketball `64dee053`, Soccer Ball `7d52afad`, Kids Kindle `e79f0e6b` via `qa:ef-repro`) → 4th UI offer (Nintendo Switch $45) → **"Too Many Open Offers" cap modal rendered with NO full-screen LogBox** (the FIX-Task-9 `console.error→console.warn` fix; prior session escalated to full-screen LogBox).
- **Cancel My Oldest Offer** → Basketball `64dee053` cancelled (reason "Buyer cancelled oldest offer to free a slot for a new offer") → slot freed → **Nintendo Switch auto-resubmitted** → Trade Initiated (`ed92e484` pending). Underlying flow fully functional. Evidence: `ios-P0-item4-cap-modal-no-logbox.png`.

### Item 5 — Seller payout-hold info (item 4 of the fix) — ✅ PASS (Android)
- On the seller's in_progress trade timeline (C06's Board Game Set trade `cb92ca6c`), the payout-hold card rendered ("Your payout is on hold until trade completes … automatically in 71h 59m … Tap for details"). Tapping it opened **"When does my payout release?"** GlobalAlert with the positive copy + Got it (`payout-hold-info-ok-button`). Evidence: `android-P0-item5-payout-hold-info.png`.

### Item 6 — Guard-modal third option — ✅ PASS (iOS) + in_progress-hidden leg deferred
- On an item with a **pending** offer (Kids Kindle `e79f0e6b`), Request to Buy → "Active Offer" guard modal with **3 options**: Go to Trade History / Dismiss / **Cancel my existing offer and re-offer** (`duplicate-offer-cancel-reoffer-button`). Evidence: `ios-P0-item6-guard-modal-3rd-option.png`.
- 3rd option → cancelled the exact pending offer (`e79f0e6b`, reason "Buyer cancelled existing offer to make a new offer") → opened TradeInitiation. DB-verified.
- **Dismiss** works (modal closes, stays on item). **Go to Trade History** works (→ My Trades, 2 offers). Evidence: `ios-P0-item6-goto-trade-history.png`.
- **in_progress-hidden leg:** NOT driven on-device — requires an in_progress trade where test-buyer is buyer; C06's trade was cancelled and no buyer-in_progress remained. Source-corroborated (FIX-Task-9 E: 3rd option only when status `pending|payment_failed`; `getActiveOfferForItem` returns `{id,status}`). Recorded as a known-gap with the single missing leg.

**Part 0 verdict:** items 1–6 verified PASS where driven; item 1's rejection-branch E2E + item 6's in_progress-hidden leg are documented gaps (tooling/fixture), both source/unit-test corroborated. No FAIL.

## 3. Part 1 — C06: SP restored on seller-cancel of in_progress trade — ✅ PASS (Android, genuine verdict)

Clean seller **test-seller-2** (counter 0, not flagged; test-seller untouched at 6+flagged).
1. test-buyer real-UI offer: **Board Game Set ($18)** with **6 SP** ($12 cash) → Trade Initiated ("You saved $6.00 using SP! … 468 SP available"). Trade `cb92ca6c` pending; wallet **474→468 avail / 6 reserved**.
2. test-seller-2 (Android) Review Offer → **Accept** (confirm modal) → "Offer Accepted!" → trade `cb92ca6c` **in_progress**, `sp_transferred_at` **NULL** (SP NOT transferred at accept — C04/D-17 consistent), auto_complete_at +3d, wallet still **468 avail / 6 reserved**.
3. test-seller-2 **Cancel Trade** (in_progress) → CancellationReasonModal → reason "Can't do pickup" → confirm → **"Trade Cancelled — Any Swap Points have been refunded to your wallet."**
4. **DB-verified: trade `cb92ca6c` cancelled** (reason "Can't do pickup", `sp_transferred_at` NULL, cancelled_at set); **Board Game Set relisted `available`**; **test-buyer wallet restored to 474 avail / 0 reserved** (6 SP fully restored — same restore RPC family as C02).
5. test-seller-2 `post_acceptance_cancellation_count` incremented 0→1; **restored to 0** (brief-directed cleanup, verified read-back). `admin_review_flagged_at` NULL throughout.

**C06 = PASS.** This also produced the in_progress seller state used for Part-0 item 5.

## 4. Part 2 — D03: full countdown color range — ✅ PASS (upgraded from PARTIAL)

Source thresholds (`countdown.ts`): `normal >6h`, `warning ≤6h`, `critical ≤2h`, `expired`. `OfferCountdownPill` bands: normal `#EFF6FF`(blue)/`#BFDBFE`, warning `#FFFBEB`(amber)/`#FDE68A`, critical `#FEF2F2`(red)/`#FCA5A5`, expired `#F8FAFC`(gray)/`#CBD5E1`.

Staged the Soccer Ball pending offer's `offer_expires_at` (DB fast-clock) and captured the pill on the buyer's My Trades:

| Stage | Staged to | On-device | Color evidence |
|---|---|---|---|
| normal | ~47h | pill "47h 41m left", light-blue | source `#EFF6FF` + visual (`ios-D03-normal-47h-pills.png`) |
| warning | now+5h | pill "5h left", amber | badge-scan: **amber_fill #FFFBEB 35.8%**, amber_border #FDE68A 2.3% (`ios-D03-warning-5h-pill.png`) |
| critical | now+90m | pill "1h 30m left", red | badge-scan: **red_fill #FEF2F2 44.3%**, red_border #FCA5A5 2.9% (`ios-D03-critical-1h30m-pill.png`) |
| expired | now−30s | pill "Expired", gray, empty bar | visual + source `#F8FAFC` (pastel scan confounded per R20 — near-white bg merges; `ios-D03-expired-gray-pill.png`) |

Countdown label progression confirmed (47h 41m → 5h → 1h 30m → Expired). **Doc-drift:** the guide's Expected Result ("green >12h / amber 6–12h / orange 2–6h / red <2h") does NOT match the actual component (blue >6h / amber ≤6h / red ≤2h / gray Expired) — the source + on-device bands are authoritative (guide is stale on both colors and thresholds). D03 **PARTIAL → PASS** for the color-progression core (4 bands).

## 5. Part 3 — Groups G/H/I Android re-drive — LIGHTLY SAMPLED (session budget)

Per the brief's Session Budget Discipline (Part 0 > Part 1 > Part 2 > Part 3; "sample-tier-2-style if needed"), after Parts 0–2 plus the environment-stability costs, Part 3 was only sampled:
- **I03** (in-chat safety banner): opened test-buyer's chat on a **cancelled** (terminal) trade — correctly shows "This chat is no longer active", disabled input, and the Trade Smart/Trade Safe card. The I03 pinned safety banner ("SP and buyer protection only apply to in-app trades…") requires an **active-trade** chat; test-buyer's today-created pending offers had no message threads to open. Recorded as observed-on-terminal-trade; active-chat leg not reached this round (already iOS-PASS on record — cross-platform only).
- **I11** (disclaimer not shown on non-trade actions): **strong incidental evidence** across the whole session — the Liability Disclaimer modal appeared **only** when tapping "Send Offer" (×4 offer submissions), and NEVER on Item Detail, Home, My Trades, Messages, Chat, Make Offer form, or the seller Review Offer screens. Confirms the disclaimer is trade-offer-gated only (source: it fires from the offer submission path).
- **G01/G02/G03/G04, H01/H03/H04/H05, I02/I04/I05/I10**: NOT re-driven this round (most already PASS on iOS; the brief flagged these as cross-platform confirmation, not first-time discovery). Recorded as deferred-to-a-dedicated-session with the per-case reasons in the tracker/ledger.

## 6. Findings & notes

1. **A1 rejection-branch not on-device-reproducible (tooling gap, not a defect):** the EF's pm validation self-heals drift (auto-attach / detach+reattach), and no QA tooling can delete a Stripe pm, so a genuine `INVALID_PAYMENT_METHOD` retrieve-throw can't be staged live. The no-relaunch swap resilience (the user-visible regression) IS verified on-device. A1's logic is unit-tested. Recommended dev/instrumentation: a `qa` fixture that can detach+delete a pm (or a `get-payment-method` force-stale path) for a true rejection E2E.
2. **Android deep-link QA-toggle delivery quirk:** the A4 read-back Alert did not surface when the toggle deep link was delivered via `adb shell am start` to a resumed Android app (iOS `simctl openurl` reliably showed it). Not an app defect — delivery/timing; recommend the R92 fresh-process gate when relying on Android toggle state.
3. **D03 guide doc-drift:** guide expects green/amber/orange/red + 12h/6-12h/2-6h thresholds; actual component = blue/amber/red/gray + 6h/2h thresholds (source + on-device confirmed). Guide copy should be reconciled.
4. **Incidental:** the Liability Disclaimer body content is Amazon-seller insurance boilerplate (pre-existing, out of scope) — flagged for awareness only.

## 7. Fixture/state left behind (clean)

- test-buyer: **0 pending / 0 in_progress** (reset via `qa:reset-offer-fixtures`), wallet **474 avail / 0 reserved**, logged OUT.
- test-seller-2: `post_acceptance_cancellation_count` **0** (restored), flag NULL. Board Game Set relisted `available`. test-seller: untouched (6+flagged preserved), 19 available items.
- Terminal residue (consistent with prior rounds): cancelled trades `cb92ca6c` (C06), `e79f0e6b` (item-6 guard cancel), `64dee053` (item-4 oldest-cancel), `7d52afad` + `ed92e484` (reset). No money moved; all holds were pre-auth on valid MASTERCARD 4444 cards.
- test-buyer's stored card is the valid MASTERCARD `pm_1UDkZt4` (ensure-cards end state — desired).
- Both apps logged OUT (Landing); no config writes; all QA toggles cleared via logout. Metro 8081 running; Metro 8082 killed (resource recovery — a fresh one is needed if a second platform-split Metro is required next session).

## 8. Coverage & running totals

- **C06:** DEFERRED (prior rounds, protecting test-seller) → **PASS** (genuine Android evidence this run).
- **D03:** PARTIAL → **PASS** (4-band color range).
- **B06 / FIX-Task-9 items:** copy/behavior re-verified on the FIX-Task-9 bundle (no count flip — B06 was already PASS; this run confirms the fix).
- TRD running total (per tracker): PASS count +2 net (C06, D03) from the prior 236 → **238 PASS**, Remaining 17 → 15 (B12/B13 were already moved in the prior round).

## 9. Calls & verdicts ratio

Manual tally per R71 (transcript pointer-only). Approx. **300–330 tool executions** this run. Genuine new verdict/evidence rows: Part 0 (6 items, counted as cross-platform unit for items verified) + C06 + D03 + Part-3 samples ≈ **10–11**. Blended ≈ 30:1. Structural cost drivers:
(a) **Android emulator/host instability at session start (~45 calls):** ANR ×2, System-UI ANR, emulator reboot, Metro 8082 kill, bundle warm ×2, dev-launcher re-connect ×4.
(b) The 6-step Part-0 offer matrices (each offer flow = item detail → offer → disclaimer checkbox/accept → submit → DB verify, ~8–10 calls × 6+ offers).
(c) Mandatory money/SP DB read-backs per step (R24/R11).
(d) D03 staged color verification (3 fast-clocks + 3 remounts + 3 badge-scans).
(e) Multi-persona C06 (offer as buyer + accept/cancel as test-seller-2 + 2 logins).

## 10. Call-count ledger

`qa:mine-call-ledger` not runnable this session (transcript pointer-only per R71) — manual tally ≈ 300–330 (above, §9). Structural drivers itemized; the environment-stability tail (~15%) is the largest avoidable next time (recoverable by confirming host memory headroom before starting an Android leg).
