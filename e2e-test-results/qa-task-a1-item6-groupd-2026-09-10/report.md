# QA Task — A1 On-Device Leg + Item-6 Leg + Group D Suite + Part 3 Continuation

**Run:** 2026-09-10 · `e2e-test-results/qa-task-a1-item6-groupd-2026-09-10/`
**Guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Platforms:** iOS Simulator `iPhone 17 Pro Max` (3F3293A3…, iOS 26.1). Android emulator (`emulator-5554`) was connected but **not driven** — Parts 0–3 do not require Android and Part 4 was budget-stopped.
**Mobile HEAD:** `907d2343` ("FIX-Task-11 + FIX-Task-10"), clean tree. Bundle: Metro `:8081`, cold-reloaded per R79-1 before Part 0.
**LLM:** DeepSeek V4 Flash · Agent-Improvement-1 (R78) + Agent-Improvement-2 (R82–R91) + R79-1 cold-reload + §5.74/R93 + §5.69 R78 discipline applied.
**Execution-only:** no source/test/seed/config files were modified. One sanctioned cleanup write (R89 persona restore, §2 below) and the tracker update (R52, permitted deliverable surface).

---

## 0. Session-start preconditions

| Check | Result |
|---|---|
| **Host free memory (HARD precondition before any Android leg)** | **44 % free system-wide ≈ 7.0 GB free of 16 GB** (`vm_stat`: 4 861 free + 223 022 inactive pages × 16 KB; `memory_pressure` = 44 %). Well above the ≥ 1 GB gate. **No Android leg was run**, so the precondition never became binding — recorded for the record as required by the brief. |
| R29 shared-resource busy check | No other agent task driving the UDID. Only `npm exec expo start --port 8081` (idle Metro) and my own mcp server. No `.locks` dir exists. Booted: 1 iOS sim + `emulator-5554`. |
| App under test | `com.sameralzubaidi.p2pmarketplace`, foreground on iPhone 17 Pro Max. |
| R79-1 cold reload | terminate → launch → bundle load → **Home with test-buyer's session** (discriminating check: fresh process, current bundle). |

---

## 1. PART 0 — FIX-Task-9's A1 rejection branch, on-device ✅ **CLOSED**

Procedure followed verbatim from §5.74 / R93. **No relaunch between invalidation and the offer attempt.**

| Step | Action | Result |
|---|---|---|
| 1 | `npm run qa:invalidate-payment-method -- --persona test-buyer --dry-run` | ✅ Correct target, zero mutation: `subscriptions BEFORE customer=cus_Ungj4MptKp9CUg pm=pm_1UE7N84I6kCJlvXoGzHa0pic status=active`; "would DETACH 1 card(s)"; "subscriptions row would be left UNCHANGED". |
| 2 | real invalidation (no `--dry-run`) | ✅ `✅ detached pm_1UE7N84I6kCJlvXoGzHa0pic` + **PROOF**: Stripe refused re-attach (`invalid_request_error` — "previously used without being attached to a Customer … may not be used again"). DB reference deliberately UNCHANGED. |
| 3 | offer as `test-buyer` **without relaunching** — listing "Kids Bike Helmet" `a8565e66-234b-4ed8-aa02-4d45e733188c` ($14, test-seller-3, available, no active offer) | Offer form showed **"Paying with MASTERCARD •••• 4444 / Expires 09/2027"** — i.e. the app still believed the now-detached card was valid (the exact A1 precondition). Send Offer → Liability Disclaimer → checkbox → Accept & Continue. |
| 4 | **Expected: friendly decline** | ✅ **PASS — "Payment Hold Failed / Payment method declined. Please update your card."** (GlobalAlertProvider, AX-exposed `global-alert-button-0`, single OK, branded white modal + green pill). **No raw error string, no error code, no retry loop, no crash, no LogBox.** Form intact behind the modal. |
| 4b | DB check | ✅ **0 trades** created in the window — a clean reject (the pm check precedes the trade insert). |
| 5 | `--restore` | ✅ **PASS** — injected a **fresh** MASTERCARD •••• 4444 `pm_1UE7ol4I6kCJlvXoLB8Z3tIY` (detached cards can never be re-attached), attached to `cus_Ungj4MptKp9CUg`, `subscriptions.stripe_payment_method_id` updated, "1 attached card(s)" verified, state file cleared. |
| 6 | offer again **in the same process** (no relaunch) | ✅ **PASS — "Trade Initiated!"** → DB: trade `8986af9c-54ac-436b-bed6-b6e804d921fb`, `pending`, $14.00 cash, mastercard 4444, PI `pi_3UE7pD4I6kCJlvXo1v6ujlaC`. **No payment error** — the payment path is healthy again. |

**Why step 6 succeeded (honest scope):** the preceding rejection had already run `invalidatePaymentMethodCache()`; the next attempt therefore re-resolved the saved card server-side and picked up the freshly-restored card. Both FIX-Task-9 paths are consistent with the observation (direct fresh resolve, or one silent self-heal retry); the UI cannot distinguish them and I did **not** claim which fired.

**Evidence:** `evidence/ios-P0-A1-friendly-decline.png`, `evidence/ios-P0-A1-postrestore-trade-initiated.png`.

**Verdict: Part 0 = PASS.** Both previously-open legs of FIX-Task-9 (the rejection branch **and** the post-restore health check) now have real on-device proof.

---

## 2. PART 1 — Item-6 in_progress-hidden guard-modal leg ✅ **CLOSED**

Fixture reused exactly as briefed: leftover trade `5abee860-17e2-4d8c-9db0-f95420053fde` (Building Blocks Bucket `0aa627e5-00a2-483e-ae84-271f373fe673`, $20, buyer **test-buyer**, seller **test-seller-3**, `in_progress`, sp_amount 0).

1. As `test-buyer`, on the item the in_progress trade belongs to → **[Request to Buy]**.
2. **Guard modal "Active Offer"** rendered with **exactly two options**: **[Go to Trade History]** (primary) + **[Dismiss]**, plus the ✕ close.
3. **Identity-level confirmation (stronger than the screenshot alone):** the full AX tree of the modal contains **only** `Go to Trade History` and `Dismiss` as Buttons — **`duplicate-offer-cancel-reoffer-button` is absent**. This is the exact expected behaviour (`ItemDetailScreen.tsx` renders the tertiary only when `guardActiveOffer.status ∈ {pending, payment_failed}`; this offer is `in_progress`).
4. **Dismiss** → modal closed, stayed on the item. ✅
5. **Go to Trade History** → navigated to **My Trades**. ✅

**Verdict: Part 1 = PASS** — the third option is provably hidden for an `in_progress` offer, and both remaining options work. FIX-Task-9's item-6 leg is no longer source-corroborated-only.

**Evidence:** `evidence/ios-P1-item6-inprogress-guard-modal-hidden-3rd-option.png`.

**Minor locator gap (instrumentation ask, not a defect):** the modal's ✕ close button is **not AX-exposed** (no testID/identifier) while the three options are; `Dismiss` covers the same outcome, so no functional impact.

---

## 3. PART 2 — Clear the leftover fixture + pinned-Cancel re-confirmation ✅

As `test-seller-3` → `p2pkidsmarketplace://trade/5abee860-…` (route **is** registered: `TradeDetail: 'trade/:tradeId'`).

| Check | Result |
|---|---|
| Pinned Cancel CTA present | ✅ `seller-cancel-inprogress-button` rendered **above the tab bar** (FIX-Task-10 pin). |
| **AX-bounds pin proof** | `seller-cancel-inprogress-button` **y 786–834** (center 810) vs tab bar `tab-sell` y 848–904 / `tab-*` y 868–905 → **clear by 14 pt, no occlusion**. Reproduces FIX-Task-10's recorded iOS bounds (y786-834) exactly. |
| Reason modal | ✅ AX-exposed on first list: `cancellation-reason-cant_do_pickup` / `-item_no_longer_available` / `-other` + `cancel-trade-keep-button` / `cancel-trade-confirm-button`. Selected "Can't do pickup" (radio filled) → confirm flipped from disabled pastel to **solid red `#FF6B6B`** = enabled. |
| Cancellation | ✅ "**Trade Cancelled** — Your trade has been cancelled. Any Swap Points have been refunded to your wallet." (`notif-ok-button`). |
| **DB verification (deliverable)** | ✅ trade `5abee860` → **`cancelled`**, `cancellation_reason="Can't do pickup"`, `cancelled_at=2026-09-10 13:18:04Z`; listing `0aa627e5` → **`available`** (relisted). **Leftover fixture CLEARED.** |

### 3a. Incidental finding — live re-confirmation of the J-class consequence ladder
The seller cancel incremented `profiles.post_acceptance_cancellation_count` **2 → 3** and set `admin_review_flagged_at` (13:18:05Z). Source read of `supabase/migrations/20260528000012_seller_cancel_consequences.sql` confirms the rule: `+1` per seller post-acceptance cancellation, and `IF v_new_count >= 3 THEN admin_review_flagged_at = NOW()` (set once, never overwritten). So this is a **genuine live level-3 consequence firing**, obtained as a side effect of Part 2 — useful corroboration for the J-series backend leg.

**Restored per R89** (shared-persona state consumed by my run), DB-verified read-back: `post_acceptance_cancellation_count = 2`, `admin_review_flagged_at = NULL` → the exact pre-run state.

**Evidence:** `evidence/ios-P2-seller-pinned-cancel-cta.png`, `evidence/ios-P2-cancellation-reason-modal.png`, `evidence/ios-P2-trade-cancelled-confirm.png`.

---

## 4. PART 3 — Automated Group D suite ⚠️ **BLOCKED (environment/harness) — no D03 evidence**

Two attempts:

**Attempt 1 — documented command, default preflight → exit 2 (environment, not test failure).**
`bash run-suite.sh --group D` booted **`iPhone 16 Pro E2E`** (74209153…) and fast-failed: *"App 'com.sameralzubaidi.p2pmarketplace' is NOT installed on the booted simulator … Fix → cd p2p-kids-marketplace && npx expo run:ios."* Per the run protocol, exit 2 = STOP and report; I did not build.

**Doc-drift found (worth fixing):** the repo's `.github/copilot-instructions.md` note claims `IOS_SIMULATOR_UDID=<udid>` is "the working override". It is **not** honoured by `scripts/preflight-setup.sh`, which resolves the target purely from `TFV2_IOS_DEVICE_NAME` (unconditionally set to "iPhone 16 Pro E2E" by `.env` line 28) and then **overwrites** `IOS_SIMULATOR_UDID` (line 99: `export IOS_SIMULATOR_UDID="$BOOTED_UDID"`). The override only survives with `--no-preflight`. (I shut the extra simulator back down to restore the pre-run device state.)

**Attempt 2 — `IOS_SIMULATOR_UDID=<17 Pro Max> … --no-preflight --group D` → ran, exit 1 (0 pass / 5 fail / 0 skip).**
The orchestrator targeted the right device, but the single Group D Maestro unit (`module-15.1.2-flow-08-trade-v2-components.yaml`, which covers D01–D05 as one asset) failed identically on **both** legs at the **post-buyer-login** assertion:

```
[Failed] module-15.1.2-flow-08-trade-v2-components (1m 2s) (Assertion is false: id: tab-discover is visible)
```

**Root cause (evidence: both on-failure screenshots).** The flow does `launchApp: clearState: true` **twice** — once before the seller login and again (`stopApp` + `launchApp clearState:true`) before the buyer login. On a dev-client build each `clearState` launch returns to the **Expo Dev Launcher**, and the flow only dismisses it once (the `tfv2-dismiss-system-dialogs` helper at the top). The captured failure frames for **both** platforms show the Dev Launcher home, not the app:
- iOS: `…/screenshot-❌-…(module-15.1.2-flow-08-trade-v2-components).png` → "Pass It Up! Development Build / DEVELOPMENT SERVERS / http://localhost:8081"
- Android: the sibling artifact → same screen with `http://10.0.2.2:8081` (the Android loopback form the helper's `text: "http://localhost:8081"` matcher cannot match).

So the JS bundle never loaded; the flow died before any D03 step.

> **Conclusion: this is an environment/harness failure, NOT a D03 regression.** The flow never reached the pill-colour assertions, so the run yields **no evidence for or against D03**. D03 remains **PASS** on its prior genuine manual on-device evidence (4-band colour range, `qa-task-trd-expanded-2026-09-09`). The suite also auto-committed its own results (`f9ec34fa`) per its design — no push.

**Recommended harness fix (dev-side, separate task):** add the Dev-Launcher dismissal helper **after every `launchApp clearState:true`** in the TradeFlowV2 flows (and make the helper's server-row matcher accept `http://10.0.2.2:8081` on Android).

---

## 5. PART 4 — Part-3 continuation (bounded slice; rest explicitly deferred)

### 5.1 TRD-TC-H01 — Free buyer sees subscription CTA — ✅ **PASS**
Fired `qa-trade-success?role=buyer&listingType=cash_only&tradeStatus=completed` as `test-free`.
- **First fire (no `feeSavingsCents`) rendered the generic fallback:** *"Trade complete! Kids Club+ gives you a flat fee and bonus Swap Points on every sale."* — the screen has two branches (`TradeSuccessScreen.tsx:66-67`), and the savings branch needs a figure.
- Re-fired with **`feeSavingsCents=200`** (a documented handler param — my first link was under-specified, **not** an app defect): *"**Trade complete! Kids Club+ would've saved you $2.00 on this trade.**"* + **[Join Kids Club+]** — matches the guide exactly (guide writes "$2"; app renders "$2.00").
- Evidence: `evidence/ios-P4-H01-free-buyer-savings-cta.png`.

### 5.2 TRD-TC-H04 — Subscriber seller on Cash Only listing — ✅ **PASS**
`role=seller&listingType=cash_only&tradeStatus=completed` as `test-seller` → "**Sale Complete!** / Great news! Your item has been sold. Earnings will be processed shortly." + *"**Sold for cash! Try "Accept SP" on your next listing to also earn SP.**"* + **[Create New Listing]** — exact guide copy. Evidence: `evidence/ios-P4-H04-seller-cash-only-upsell.png`.

### 5.3 TRD-TC-H03 — Subscriber seller on Accept SP listing — ✅ **PASS**
`role=seller&listingType=accept_sp&tradeStatus=completed` → *"**0 SP releasing in 3 days — added to your pending wallet.**"* + **[View Wallet]** → tapping it **opened the SP Wallet** ("Swap Points", 2209 SP) ✅. Template + CTA exact; the `0` is a forced-render artifact (no real trade/SP behind the fixture) — the same screen's wallet shows a real "47 SP Pending Release", which is what a genuine Accept-SP sale would populate. Evidence: `evidence/ios-P4-H03-seller-acceptsp-pending-sp.png`.

### 5.4 Deferred (explicit, no silent skips)
| Item | Status | Reason |
|---|---|---|
| TRD-TC-G01–G04 | **DEFERRED** | Need clock fast-forwards at 6h/1h (G01) and 24h/2h (G02) plus reminder-send observation; G03/G04 are throttle/deep-link legs. All already **PASS on iOS** on record — the outstanding work is cross-platform (Android) confirmation, not first-time discovery. Budget-stopped per the brief's ordering. |
| TRD-TC-H05 | **DEFERRED** | Subscription lifecycle regression (trial→paid→cancel) — expensive multi-step fixture work; H05 was flagged "sample only if time allows". |
| TRD-TC-I02, I04, I05, I10 | **DEFERRED** | All four need an active (`in_progress`) trade + chat/listing fixtures (I10 additionally needs a slow-network condition). All already **PASS on iOS** on record; outstanding work is Android confirmation. The in_progress trade used for Parts 1–2 was deliberately cancelled in Part 2 (its explicit purpose), so none remained. |
| **D03 AutoCompleteBanner buyer-in_progress staged drive** | **DEFERRED** | Requires creating and then cleaning a fresh buyer `in_progress` trade (another seller-cancel → another counter increment/restore cycle). Budget-stopped to protect the mandatory tracker + report + §8.3 deliverable. |

**Per-platform verdict disclosure (R80):** for every deferred row above, **iOS already holds a genuine verdict (PASS on record)**; the single missing leg is the **Android** cross-platform confirmation. A future Android session needs only those per-platform drives — not a re-derivation of the flows.

---

## 6. App state left behind (DB-verified at session close)

| Object | Final state |
|---|---|
| `test-buyer` | **0** active trades (pending/payment_failed/in_progress). Wallet 474 avail / 0 reserved. Saved card = **valid restored MASTERCARD •••• 4444** (`pm_1UE7ol4I6kCJlvXoLB8Z3tIY`). Logged out. |
| Part-0 side-effect offer `8986af9c` | **cancelled** via the documented `qa:reset-offer-fixtures`; listing `a8565e66` back to `available`. |
| Leftover fixture `5abee860` (Part 2 goal) | **`cancelled`** (reason "Can't do pickup"); listing `0aa627e5` **`available`**. |
| `test-seller-3` | `post_acceptance_cancellation_count` **2**, `admin_review_flagged_at` **NULL** (pre-run state restored, R89). |
| `test-free` / `test-seller` | No writes. (Incidental observation: `test-seller`'s SP Wallet renders a **"Grace Period Active"** banner with 2209 SP — pre-existing subscription state, not touched or asserted by this run; flagged for awareness only.) |
| **Blast radius (R93 disclosure)** | The fixture **permanently consumed one test-mode card** (`pm_1UE7N84I6kCJlvXoGzHa0pic`, detached — never re-attachable). Test-mode only, re-provisionable. Restore left exactly one valid 4444 card. |
| Suite commit | `f9ec34fa` (the harness's own post-run commit, per design — **not pushed**). |
| Device | iPhone 17 Pro Max booted, app on Landing (logged out). `iPhone 16 Pro E2E` shut back down. Metro `:8081` still running. No config writes; no QA toggles armed. |

---

## 7. Calls & verdicts

**R71-fallback applies:** the session transcript is **pointer-only** (`main.jsonl` = 264 bytes; `qa:mine-call-ledger` reports *0 messages / 0 tool executions*), so no mined figure exists. The count below is a **labeled manual tally**, and desk-work is isolated from device-execution so the comparison is apples-to-apples.

| Bucket | Approx. calls |
|---|---|
| Device execution (mobile-mcp: launch/screenshot/tap/list/save) | ~52 |
| Desk work (recon reads, greps, memory) | ~18 |
| DB read-backs (R24/R11/R54) + one R89 restore | ~9 |
| Terminal (fixtures, suite ×2, doc deep links, env checks) | ~16 |
| view_image forensics + tracker/report writes | ~8 |
| **Total** | **~100–105** |

**Verdicts produced: 8** (P0 rejection branch; P0 post-restore health; P1 item-6 leg; P2 fixture-clear + pin; P3 suite; H01; H03; H04).

- Blended: **~13 calls/verdict.**
- **Device-execution only: ~6.5 calls/verdict** — at/below the R78 target band (6–7) and well under the 43c 9.6 baseline.

**Structural cost drivers (flagging honestly):**
1. **Part 3 (~20 calls + 2 Maestro runs ≈ 2.5 min)** for a **negative** result — the suite's designated simulator has no app installed, and the documented `IOS_SIMULATOR_UDID` override is dead code under preflight. A pre-flight check of *"is the app installed on the suite's target?"* would have predicted the exit-2 in one command.
2. **Dev-client relaunch tax (~10 calls)** after the suite's `clearState:true` wiped the app data — Dev Launcher → server row → dev-menu intro → "Go home" bounce → re-load → re-login.
3. **`--no-preflight` side-effect:** skipping preflight also skipped `seed:staging` and the software-keyboard suppression, which is one of the reasons the Maestro flow could not complete.
4. Mandatory evidence screenshots (§5.6) and DB read-backs (R24/R11) — irreducible and correct.

---

## 8. Coverage & tracker

**Coverage tracker updated (`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`), R52:** rows **TRD-TC-D03, H01, H03, H04** refreshed — `Latest`/`Date`/`Source` → `2026-09-10` / `qa-task-a1-item6-groupd-2026-09-10`; each `Status` **unchanged** (all remain ✅ PASS), with D03's row carrying the explicit **automation BLOCKED (env, not a regression)** note. **No TC flipped Remaining → Completed this round** (Parts 0–3 are FIX-Task verifications, not guide TCs; Part 4 re-verified already-PASS rows). Per-guide roll-ups: **no count movement** (TRD PASS 238 · Remaining 15 — unchanged).

---

## 9. Findings

1. **FIX-Task-9's last two open gaps are closed** — the A1 rejection branch is proven on-device (friendly decline, no loop/crash) and the item-6 in_progress-hidden option is proven at identity level. No code change needed.
2. **Harness defect (dev-side task):** every `launchApp clearState:true` on a dev-client build lands on the Expo Dev Launcher, and the TradeFlowV2 flows only dismiss it once → the Group D asset cannot pass on a dev-client build on either platform. Also the Android matcher (`http://localhost:8081`) misses Android's `http://10.0.2.2:8081`.
3. **Doc drift:** the `IOS_SIMULATOR_UDID` override documented in `.github/copilot-instructions.md` does **not** work with preflight (it is overwritten at `preflight-setup.sh:99`); only `--no-preflight` honours it.
4. **Minor instrumentation gap:** the Active-Offer guard modal's ✕ close button is not AX-exposed.
5. **Harness/deliverable pitfall (caught in-flight):** the forced TradeSuccess screen renders a **fallback copy** unless `feeSavingsCents` is supplied — a QA link that omits it will look like a copy regression. Worth documenting alongside the deep-link registry.
6. **Incidental:** `test-seller`'s SP Wallet currently shows "Grace Period Active" (pre-existing state; noted, not asserted).

---

## 📋 QA Session Handoff

**Test Scope:** Part 0 — FIX-Task-9 A1 rejection branch on-device (`qa:invalidate-payment-method`, §5.74/R93) incl. restore + post-restore health; Part 1 — FIX-Task-9 item-6 in_progress-hidden guard-modal leg; Part 2 — leftover fixture `5abee860` clearance + FIX-Task-10 pinned-Cancel re-confirmation; Part 3 — automated Group D suite; Part 4 (partial) — TRD-TC-H01, H03, H04 live re-verification (iOS).
**Design-System Compliance:** PASS — no deviations found on any screen/dialog checked this run (Item Detail, Make Offer, Liability Disclaimer modal, Active Offer guard modal, Trade Timeline, CancellationReasonModal, Trade Cancelled alert, My Trades, Trade Initiated, Trade/Sale Complete, SP Wallet). Primary CTAs render the documented filled pill `#5DBB8E`; the destructive confirm renders the documented `#FF6B6B` with the correct pastel disabled state (`#FFE7E7`→solid on enable); modals use the white surface + single-primary convention; the FIX-Task-10 pinned CTA sits clear of the tab bar.
**Perceived Load-Time Verdict:** GOOD — all observed transitions rendered under the 3 s ideal threshold (offer submit → decline alert ≈1–2 s; offer submit → Trade Initiated ≈2–3 s with a visible Send-Offer spinner; modal open/close ≈instant; deep-link landings ≈1–2 s; the ~12–20 s cold bundle load on the first launch after the suite's `clearState` is a **dev-build cold-start artifact**, not app behaviour).
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Item Detail ("Kids Bike Helmet" / "Building Blocks Bucket"): layout, spacing, single primary CTA, "Swap Points Eligible" banner all per design system.
- CONFIRMED — Make Offer screen: SP field, payment-method cards, "Trades are protected by our safety guidelines" panel, value stack ($14.00 + $1.49 fee + $0.98 tax = $16.47) correct; loading spinner on submit.
- CONFIRMED — Liability Disclaimer modal: title, version chip, checkbox row, Cancel + Accept & Continue (correctly disabled → enabled); checkbox correctly resets on reopen (I09 behaviour observed twice).
- CONFIRMED — "Payment Hold Failed" alert: friendly copy, no raw code, single branded OK, `#5DBB8E` pill.
- CONFIRMED — "Active Offer" guard modal: two-option layout, correct primary/secondary hierarchy, tertiary correctly absent for in_progress.
- CONFIRMED — CancellationReasonModal: "Why are you cancelling?", 3 reasons + subtitles, Keep Trade (secondary) / Cancel Trade (danger, correctly enabled only after selection).
- CONFIRMED — "Trade Cancelled" alert: friendly copy incl. the SP-refund reassurance.
- CONFIRMED — My Trades / Trade Initi‑ated / Trade Complete / Sale Complete screens: hierarchy, one primary per screen, copy readable and parent-appropriate.
- CONFIRMED — SP Wallet ("Swap Points"): brand-green hero, Shop/Sell/History actions, Grace Period banner uses the documented amber warning treatment.
- DEVIATION — none found this run.
**Verdict Summary:** 7 PASS / 0 FAIL / 1 BLOCKED (Part 3 suite — environment/harness) / 0 SKIPPED (Part 4 remainder explicitly DEFERRED with reasons).
**Coverage Tracker Updated:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — refreshed **TRD-TC-D03** (Status unchanged ✅ PASS; Date/Source → 2026-09-10 / `qa-task-a1-item6-groupd-2026-09-10`; Notes + explicit "Group D automation = BLOCKED (env, not a regression)" caveat), **TRD-TC-H01** (PASS; + `feeSavingsCents` param requirement noted), **TRD-TC-H03** (PASS; + forced-render `0 SP` caveat), **TRD-TC-H04** (PASS; guide copy exact). **No Remaining → Completed flips this round** (Parts 0–3 are FIX-Task verifications, not guide TCs; Part 4 re-verified already-PASS rows). Per-guide totals **unchanged**: TRD PASS 238 · Remaining 15.
**Critical Findings:**
1. **(Harness, P1)** Group D automated unit cannot pass on a dev-client build on either platform — `launchApp clearState:true` lands on the Expo Dev Launcher and is only dismissed once, so the flow dies at the post-login `tab-discover` assertion; the Android matcher also misses `http://10.0.2.2:8081`. Evidence: both on-failure screenshots.
2. **(Harness setup, P1)** The suite's designated simulator `iPhone 16 Pro E2E` has **no app installed** → preflight exit 2. The documented `IOS_SIMULATOR_UDID` override does **not** work with preflight (overwritten at `preflight-setup.sh:99`) — doc drift.
3. **(QA tooling, P3)** The Active-Offer guard modal's ✕ close button is not AX-exposed (no testID).
4. **(QA docs, P3)** `qa-trade-success` without `feeSavingsCents` silently renders the generic fallback upsell — easy to mis-report as copy drift.
**App State Left Behind:** `test-buyer` — 0 active trades, valid restored MASTERCARD 4444, logged out. Leftover fixture `5abee860` **cancelled**, listing relisted `available`. Part-0 side-effect offer `8986af9c` cancelled + listing relisted. `test-seller-3` — count 2 / flag NULL (restored). `test-free`/`test-seller` unwritten. **Blast radius:** one test-mode card permanently detached by the FIX-Task-11 fixture (re-provisionable). Suite commit `f9ec34fa` created (not pushed). Simulator left booted on Landing; extra simulator shut down.
**Why It Matters:** FIX-Task-9 is now **fully closed** — its two previously unproven behaviours (the friendly decline when the saved card is genuinely unusable, and the absence of the re-offer option on an in_progress offer) have real on-device evidence, so the payment-rejection UX can be trusted not to leak raw errors or trap the user in a retry loop. Separately, the automated TradeFlowV2 suite's Group D asset is currently **incapable** of producing a verdict on a dev-client build, which means its green/red signal for that group cannot be relied upon until the launch flow is fixed — a QA signal-integrity risk worth fixing before it masks a real regression.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/qa-task-a1-item6-groupd-2026-09-10/evidence/` (7 PNGs). Part 0: `npm run qa:invalidate-payment-method -- --persona test-buyer [--dry-run|--restore]`, then submit a real offer without relaunching. Part 1: open `p2pkidsmarketplace://listing/0aa627e5-00a2-483e-ae84-271f373fe673` as `test-buyer` → Request to Buy. Part 2: as `test-seller-3`, `p2pkidsmarketplace://trade/5abee860-17e2-4d8c-9db0-f95420053fde` → pinned Cancel Trade. Part 3: `bash test-automation/trade-flow-v2/scripts/run-suite.sh --group D` (see `e2e-test-results/2026-09-10T13-21-21/report.md`; failure frames in `~/.maestro/tests/2026-09-10_0921*`). Part 4: `p2pkidsmarketplace://qa-trade-success?role=…&listingType=…&tradeStatus=completed[&feeSavingsCents=200]` after `qa-login-as?persona=…`.
**Known Gaps / Not Tested:** Part 3 produced **no D03 verdict** (harness-blocked; D03 remains PASS on the 2026-09-09 manual 4-band drive). Part 4 remainder DEFERRED: G01–G04, H05, I02/I04/I05/I10, and the D03 AutoCompleteBanner buyer-in_progress staged drive — **each already holds an iOS PASS**; only the Android cross-platform leg is outstanding. Part 0 step 6's exact internal path (fresh resolve vs one self-heal retry) is not distinguishable from the UI and was not claimed. H03's non-zero SP total is not exercised by the forced fixture. Android was not driven at all this round.
**What Needs To Be Fixed Next:**
1. **Fix the TradeFlowV2 dev-client launch flow (P1):** add the Dev-Launcher server-row dismissal after **every** `launchApp clearState:true` in the TradeFlowV2 flows/helpers (at minimum before the buyer-login step in `module-15.1.2-flow-08-trade-v2-components.yaml`), and widen `tfv2-dismiss-system-dialogs.yaml`'s matcher to accept Android's `http://10.0.2.2:8081` in addition to `http://localhost:8081`.
2. **Install the app on the suite's designated simulator (P1):** run `yarn ios:sim-build` (FIX-3 fast path) targeting `iPhone 16 Pro E2E`, or point `TFV2_IOS_DEVICE_NAME` at a simulator that already has the build.
3. **Correct the doc drift (P2):** update `.github/copilot-instructions.md` — the `IOS_SIMULATOR_UDID` override is only honoured **with `--no-preflight`** (`preflight-setup.sh:99` overwrites it), or fix the script to respect an explicitly-provided UDID.
4. **Instrument the guard modal's close control (P3):** add `accessible`/`accessibilityRole`/`testID` to the Active-Offer modal ✕ (BP-53 class).
5. **Document `feeSavingsCents` (P3):** record the `qa-trade-success` parameter set (incl. `feeSavingsCents`) in the QA deep-link registry so free-buyer H01 is never mis-read as copy drift.
**UX Enhancement Ideas (optional, not defects):**
- On **My Trades → Your Offers**, the buyer's offer row renders the countdown in a rounded pill with a progress bar, while D03's QA flag records the **seller's** Offers-tab rows as plain text — consider unifying the two surfaces' countdown treatment so the same state reads the same way regardless of which side of the trade you are on.
- On the **Liability Disclaimer modal**, the body is a long scroll of commercial-insurance boilerplate; every offer submission requires scrolling past it to reach the acknowledgment row. Consider a collapsed summary with an expandable "full policy" section so the checkbox is reachable without a long scroll.
- On the **forced/edge TradeSuccess screens**, the SP figure can render as "0 SP releasing in 3 days" when no SP is behind the render — consider suppressing the line when the total is zero so a real zero never reads like pending value.
**Suggested Next Session:** an **Android cross-platform round** for the four deferred groups (G01–G04, H01/H03/H04 re-drive, I02/I04/I05/I10) plus the D03 AutoCompleteBanner buyer-in_progress staged drive — using a created-then-restored `in_progress` fixture, and confirming ≥1 GB free host memory before starting (this session had ~7.0 GB).
**Suggested to Improve Agent Rules:** add an **R94 — pre-flight the automated suite's own preconditions before invoking it**: one cheap check (is the app installed on `TFV2_IOS_DEVICE_NAME`'s simulator? is a second simulator about to be booted? does the target flow require a dev-client server-row dismissal after each `clearState` launch?) predicts both failure modes seen here (preflight exit 2, and the Dev-Launcher flow stall) and would have saved ~20 calls plus two Maestro runs. Relatedly, extend R71-fallback with the concrete confirmation that the VS Code debug-log `main.jsonl` is **pointer-only on every session** on this machine (264 bytes, 0 executions) — so the manual-tally path can be assumed rather than rediscovered.
