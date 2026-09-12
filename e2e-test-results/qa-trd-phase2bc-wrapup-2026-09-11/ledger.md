# Ledger — QA TRD Phase 2b/2c wrap-up (Android), 2026-09-11 → 09-12

## Call accounting (R71-fallback: transcript not mineable in a live session — **manual tally**, labelled as such)

| Phase | Approx. tool executions | Notes |
|---|---:|---|
| Recon — playbook (§4–§9), repo memory, tracker, guide sections (O, R, U, X, Y, N2) | ~26 | R78-1 recon-first; guide reads were batched/parallel |
| R29 busy check + fixture build + schema recon | ~9 | incl. 3 schema 42703s (cheat-sheet corrections) |
| Android bring-up (launch, dev launcher, cold-connect recovery, ~20 polls) | ~22 | F7 harness artefact |
| Buyer connected flow (home → cart → checkout → SP → disclaimer → offer → trades → basket) | ~24 | produced ~20 verdict-class items (R72 batching + R82 one-flow-many-verdicts) |
| R05 chain (persona switch → seller timeline → cancel modal → confirm → DB) | ~10 | |
| R02 chain (persona switch → my trades → review offer → decline → DB) | ~12 | |
| N2 desk queries (2 queries, 1 retraction re-query) | ~4 | |
| Restore + report + tracker | ~5 | |
| **Total (manual tally)** | **≈110** | **≈33 verdict-class items ⇒ ≈3.3 blended** |
| — of which device-execution | ≈70 | **≈2.1 device calls / verdict** |
| — of which desk (recon, schema, DB, reporting) | ≈40 | isolated per the R71-fallback comparison discipline |

**Caveat:** these are a **manual tally**, not a mined figure — the session's debug-log folder does not expose a usable execution stream, so `qa:mine-call-ledger` could not run. The device-per-verdict figure is unusually low because several tree reads each carried 3–6 verdicts (batched taps, no per-tap screenshot confirmation on AX-drivable surfaces — R72/R64).

## Tooling facts discovered / re-confirmed (for the next round)

1. **Android IME is invisible to the uiautomator tree.** With the numeric keypad up, `mobile_list_elements_on_screen` returned no IME nodes and reported content coordinates as if the keyboard were absent → a tap at a tree coordinate landed on a keypad key and typed into the still-focused SP field (5 → 16). **Screenshot is the only keyboard gate on Android.** (New — sharpens §5.19 Rule 1 / §5.2.)
2. **Cold dev-client start** on this emulator: launch → dev launcher → Metro row → blank frame → splash → AuthContext spinner → Home, ≈20 polls; **Metro idle at 0.7 % CPU** throughout ⇒ native-init/first-frame cost, not bundling (consistent with FIX-Task-17 item 9 / F9).
3. **`qa-login-as` fired while the app is cold can exit the app to the launcher** (observed on the first persona login; subsequent warm-navigation persona switches worked normally).
4. **Schema corrections (3 × 42703 — cheat sheet updated):** `items` has **no** `deleted_at` and **no** `item_payment_preference` (SP eligibility = `accepts_swap_points` BOOLEAN; cart-level string lives on `cart_items`); `tax_rules` thresholds are **`min_item_price_cents`/`max_item_price_cents`**.
5. **`qa-set-sp` deep link is unusable from a zsh `adb shell am start` invocation** — the `&amount=` separator is dropped by the shell/tool layer (the intent arrived as `qa-set-sp/...` with `com.sameralzubaidi.p2pmarketplace` treated as a separate command). Use single-param deep links, or type into the SP field.
6. **Carried-forward Android facts confirmed this round:** AX tree reports physical pixels 1:1 (no 3× multiply); the `qa-login-as` deep link works warm; the `mobile_swipe_on_screen` no-op class reproduced on the checkout ScrollView (a 1200 px swipe produced no scroll change) while a later 500 px swipe on the Review Offer screen did scroll.
7. **Overlapping tree boxes with no z-order** reproduced again: `seller-cancel-inprogress-button` (y1980–2106) vs `next-steps-cta` (y1939–2056) — the R31/R22 pre-tap viewport check mattered; the swipe-then-re-list step is what made the Decline tap safe.
8. **`seller_payouts` has 21 rows with `trade_id IS NULL`** — any "payouts per trade" duplicate query must filter NULLs or it reports a false duplicate group (F9; a candidate finding retracted before escalation, R15/R24).

## Decision → outcome log (condensed)

| # | Trigger | Decision | Outcome |
|---|---|---|---|
| 1 | Landing + first `qa-login-as` | Fire the deep link (R75, 1 call vs 8–10 UI taps) | App exited to launcher; recovered via relaunch → dev launcher → Metro row (F7) |
| 2 | Blind AX tree (1 empty dump + 1 status-bar-only dump) | Screenshot before relaunch (R-NEW-1 escalation ladder) | App was in the dev launcher; correct call, avoided a needless relaunch |
| 3 | Cart screen tree returned the *previous* screen after the CTA tap | Screenshot as source of truth (§5.9) | Tap had actually navigated to Checkout — tree was stale; no false verdict |
| 4 | Cart rows read "Accounts Points" + "Points unavailable for this item" | Do **not** report immediately (R59 stale-until-fresh) | Next frame proved it was a load transient → reported as a **transient** copy defect (F2), not as a broken cap |
| 5 | Tap at (540,1850) changed the SP field instead of pressing Send Offer | Screenshot to identify the cause before asserting | Numeric IME was up and invisible to the tree → F6; no mis-tap recorded as a product finding |
| 6 | SP landed at the category max (16) rather than my typed 5 | Keep and use it (R33 reuse incidental state) | Produced the strongest T04 evidence (cap-limited, not wallet-limited) + a second O02 data point |
| 7 | "Duplicate payout for one trade" appeared in the N2 query | Re-query before escalating (R15/R24) | It was the NULL `trade_id` bucket → **retracted**, no bug filed (F9) |
| 8 | `decline-trade-button` reported at y2290–2400 (under the tab bar) | Swipe up 500 px, re-list, then tap (R31/R22) | Tap landed correctly; no wrong-tab navigation |
| 9 | test-seller-3's cancellation count consumed by R05 | Restore to 2 + flag NULL, DB-verify (R89) | Restored and verified before the run closed |
| 10 | Two `PARTIAL` rows (O05, T01) hit their limits on one limb only | Record PARTIAL with the exact missing limb named (R13) | Known Gaps states precisely what was and was not driven |
