# Decision & Outcome Ledger — qa-fix27-verify-n2-phaseE-2026-09-13

Device: Android `Medium_Phone_API_36.1` (1080×2400). HEAD `ea51dcb4`. iOS booted, NOT driven (R80).

| # | Action | Reasoning | Outcome |
|---|---|---|---|
| 1 | Read playbook + `/memories/repo/qa-test-agent.md` + `fix-task-27-2026-09-13.md` + `qa-test-accounts.md` + the 2 prior-round notes | Mandatory §4 pre-read; R78-1 recon-first | Recon complete in ~6 calls; all FIX-Task-27 owed legs + instrumentation IDs known before touching the device |
| 2 | `git log`/`status` | Record the build under test | HEAD `ea51dcb4`; FIX-Task-27 **is** committed; tree clean |
| 3 | `adb devices` / `simctl list devices booted` / `lsof :3001` / `pgrep expo` | R29 shared-resource busy check | Emulator 5554 online; iOS sim booted; Metro 8081+8082 up; admin :3001 up. No other agent driving → not busy |
| 4 | Leg 4 FIRST (seller-read) instead of guide order | Repurposed the already-open Item Detail (seller card on screen) — §5.33 | Saved a full navigation cycle |
| 5 | Armed toggle → dismissed dialog → **re-listed** | The first screenshot showed no alert; re-listing found the modal had rendered late | The `[QA] Toggle Applied` dialog appeared only after the first tap; **log line is the reliable arming proof** |
| 6 | Tapped back-button, then re-opened a Discover card | Needed an Item Detail re-mount to re-run the seller read | Re-mounted; error card 996×235 + retry 996×95, both clear of the CTA band |
| 7 | Disarm **before** tapping retry | The stall hook short-circuits on every load; retrying armed would stall again | Retry recovered the card in place, <1 s |
| 8 | Cart looked empty although a "4" badge was visible | R100: reconcile a suspicious badge before filing | The badge was **`tab-trades-badge`**, not Basket — the cart really was empty. Avoided a false "cart/badge leak" finding |
| 9 | Built the 3-item cart through the **UI** rather than `qa:create-bundle-fixture` | Better evidence; avoids creating new fixture rows | 3 adds confirmed by toast + badge 1→2→3 |
| 10 | Batched 3 taps (card→Add→back) | Speed | **Partial failure**: only the card tap landed (the mount wasn't ready). Recovered by re-tapping Add individually |
| 11 | Leg 2: drove the real confirm dialog → Remove | Guide's flow includes a confirm | Rollback + `cart-remove-error-card` + `cart-remove-retry-button`; log confirmed the simulated failure |
| 12 | Disarmed then tapped retry | Same reasoning as #7 | Item genuinely removed; badge 3→2 |
| 13 | Leg 3 `once` armed **before** the persona switch I already needed | §5.31/§5.33 — one action serves two purposes | Self-heal proven (`attempt 1/3 failed`, then success) + persona switched for Leg 1 |
| 14 | Leg 5 scored from the Trade List already on screen | §5.27 simultaneous evidence | `-pending-count` = "All 2 awaiting your review"; single vs bundle treatments captured |
| 15 | **AX dump while Review Offer was stalled** | Routine re-list | **CRASHED the app** — `SIGSEGV` in `mobilecli.so → AgentSpec::Attach → VMDebug.attachAgent`. Read the tombstone (R87) → dev-tooling crash, **not** an app bug. New rule: screenshots only inside a stall window (F7) |
| 16 | Cold relaunch → picked `:8081` (the *other* Metro row) | Dispatch's own workaround; the first row wedged | Loaded successfully |
| 17 | Re-drove Leg 1 with **screenshots only** | Apply #15's lesson | Passed: 20 s → `review-offer-load-error` + retry; retry loaded the offer |
| 18 | Noticed the Home SP strip flip 2263 SP → "Unlock Swap Points" | Out-of-scope observation, but user-visible and wrong | Read the client's own log (R102 ordering): `get_subscription_status skipped due transient network issue` → **F1** (fail-soft returns a *free* summary) |
| 19 | Leg 3 `persist` | Prove the wedge recovery | 3 × (3 profile-read failures) → `Cleared the half-switched session` → `[NAV] route: Landing`. No wedge |
| 20 | Phase D C09 DB-helper leg (2 calls + count) | Cheapest N2 leg; zero side-effect risk | `true` → `false`, 1 row |
| 21 | Read `rpc_release_pending_sp` **and** the repo migration before filing | R100 name-the-writer | RPC writes wallet + trade + notification only → the guide's audit sub-assertion is unsatisfiable → **F2** (not a finding against the app's idempotency) |
| 22 | Fast-clocked 1 trade (due-now count was 0) then called the RPC twice | Bounded: exactly one trade due | `released_count: 1` → `0`; +7 exactly once. Corroborated on-device later (Home showed **2263 SP**) |
| 23 | C05 refund leg on the **existing** `sp_refund_…` key | Chose the zero-mutation shape after reading `debit_sp_for_trade`'s guard-first body | Both calls `idempotent:true`, same `ledger_entry_id`, 1 row, balance unchanged |
| 24 | C05 debit leg: 1 point, **synthetic** trade uuid | Bound the blast radius; avoid double-debiting a real trade | `balance_after 458` once; second call `idempotent:true` |
| 25 | C02 on a `requires_action` payout | All fixtures are `requires_action`; the transfer branch is unreachable | Retried-trigger guard verified (1 row, no transfer, **no new notifications**); transfer-count leg recorded N/A |
| 26 | C03 | Needs a **signed** Stripe webhook re-delivery | ⏸ BLOCKED (harness); data invariant observed as F5 rather than a defect claim |
| 27 | C06 `+1` with an explicit key on a fixture persona | Guide says +10; +1 proves the same thing with less residue | `new_balance 1` not 2; 1 ledger + 1 audit row |
| 28 | Leg 6 first attempt → **Checkout Failed / DUPLICATE_OFFER ×3** | R23 read the backend error before hypothesising | Root cause = stale pending/in-progress offers from earlier rounds held those listings. Not an app bug |
| 29 | Cleared the basket → `qa:create-bundle-fixture` | Cheaper than swapping 3 listings item-by-item (~4 calls vs ~15) | Fresh bundle `4a0ebecf…` + preloaded cart |
| 30 | Batched [send-offer, checkbox, accept] | Speed | **Failed silently** — the modal wasn't rendered; tap 3's (798,2285) is inside `tab-trades` → navigated to My Trades, no offer. Verified via the JS log + DB (**F8**). Re-driven sequentially → worked |
| 31 | Checkbox tap at the AX row centre (540,2138) failed **twice** | Tree said full-width row | Screenshot + `sips` proved the frame is 1080×2400 and the tree was right; tapping the **square** (73,2138) worked instantly → **F3** (label row inert) |
| 32 | Leg 6 read-back | The case's assertion | **3 of 3 siblings `disclaimer_acknowledged = true`** (vs 1 of 3 on both pre-fix bundles) → item 3 VERIFIED FIXED |
| 33 | Set `min_listing_price` 5 → **reverted to 0** | N-group precondition; R28 requires revert + read-back | Both writes read back correctly; **no config left changed** |
| 34 | Persona switch to test-seller wedged (`[trade] Error counting active trades` LogBox + spinner) | Known R101 class | Force-stop + cold relaunch + pick `:8081` → recovered |
| 35 | Stopped Phase E after the wedge and reverted the threshold | Remaining budget reserved for the mandatory report/tracker/handoff rather than a partial bulk-flow drive | Phase E reported honestly as 10 re-verified / 35 not reached, each with its reason |
| 36 | Scored 10 dispatched + 4 bonus rows from frames captured **incidentally** during Phase 0/D | §5.33 / §5.27 — the same build, same session | 2 legitimate PARTIAL→PASS promotions (S11, S22) + Android evidence on 12 rows; method disclosed in the report |
