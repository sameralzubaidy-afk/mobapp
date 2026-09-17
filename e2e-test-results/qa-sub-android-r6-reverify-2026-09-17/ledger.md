# Ledger — SUB Android Round 6 (2026-09-17)

Run: `e2e-test-results/qa-sub-android-r6-reverify-2026-09-17/`
Device: AVD `Medium_Phone_API_36.1` (`emulator-5554`), 1080×2400 — AX coords == device px.
Personas: `test-buyer` → `test-expired` → `test-grace` → `test-seller` (4 sessions, 3 switches).
Mode: execution-only. **No SQL writes by the agent.** Sanctioned helpers used: `qa:admin-config-set` (1 set + 1 revert), `qa:badge-scan`, `qa:payout-fixture -- dry-run`, `adb am start` (deep links).

## Decision-and-outcome log (per episode)

| # | Trigger | Reasoning | Calls | Outcome |
|---|---|---|---|---|
| 1 | R29 busy check + env health | device list, Metro instance, load average, AVD name | 6 | 1 device; 1 Metro (on **:8082**, R63a variant); **load 29.05** = DEGRADED |
| 2 | DB precondition recon | persona/subs/wallet states; `pending_sp_release_days`=3; `grace_period_days`=30 | 6 | All fixtures correct. **Schema surprise:** `subscriptions` has no `subscription_expires_at` (42703) — the bug's own mechanism |
| 3 | Dev client appeared frozen at `Bundling 81.0%` | screenshot is the truth channel; terminate + relaunch + tap Metro row | 9 | Recovered. **The "stuck" frame was a STALE CACHED screenshot** — the bundle was progressing |
| 4 | C03 drive | `qa-login-as test-buyer` → `manage-kids-club` | 3 | **PASS** — "September 27, 2026" + "11 days" + helper; ≈13 s first mount |
| 5 | C03 cross-screen | `my-subscription` → read `renewal-date` | 3 | **PASS** — "Sep 27, 2026" ⇒ the two screens agree |
| 6 | FIX-47 item 13 | scroll → `cancel-kids-club-button` → tree the modal | 6 | **VERIFIED** — all 6 reasons visible (6th at y1518; old cap = 250) |
| 7 | C05/C06 chain | select reason → Confirm → alert OK → re-open Manage | 6 | **PASS** — `status=canceled` in DB; "Access Until: September 27, 2026"; Days Remaining; Auto-Renew OFF |
| 8 | C07 update-PM sub-leg | tap `update-payment-method-btn` → poll the sheet | 5 | **PASS** — native Stripe setup sheet (Link / saved 4444 / New card / Set up) |
| 9 | C07 toggle + D05 | switch ON → alert → DB → leave+re-enter | 6 | **PASS** — `canceled→active`, no new charge. **Observation:** the screen kept the stale cancelled copy until remounted |
| 10 | C02 three rows | billing → back → payment → back → support | 8 | **PASS** all three. **Near-miss:** a BACK had already returned to **Home**, so the "support" tap hit the Payouts tile — caught by re-deriving from the tree, **not filed** |
| 11 | C11 | `benefits-learn-more-button` | 2 | **PASS** — Help / `sp_definition` |
| 12 | C09 + D03 | `qa-login-as test-expired` | 8 | **PASS both.** D03 gate renders; **NEW MED finding:** `continue-free-link` under the tab bar → tapping it **opened the Sell sheet** |
| 13 | D01 + A05 grace | `qa-login-as test-grace` → Manage → `sp-wallet` | 5 | **PASS (structure)** + **NEW MED copy deviation:** Manage says SP "frozen", SP Wallet says spendable (same user/build) |
| 14 | F08 | `payout-settings` → 3 × Load More → tree at the end | 16 | **PASS** — `load-more-button` gone, "That's all your payouts" renders; failed-row copy now generic. Long-list scrolling dominated the cost |
| 15 | NotificationSetup | `notification-setup` → `qa:badge-scan` on the button band | 4 | **VERIFIED** — 94.07 % `#5DBB8E` / 0.00 % `#4CAF50` |
| 16 | F06 | config set/revert + `seller_balance` + payout-release query | 8 | **PARTIAL** — hero↔DB 3/3 exact; config leg driven+reverted; release-transition legs not drivable (cleanup is destructive; fast-forward needs a DB write) |
| 17 | item 12 | fresh-mount the payout load, poll for the notice | 5 | **NOT VERIFIED** — load completed inside the 20 s bound; forcing it needs a source edit (outside this role) |
| 18 | Design sweep + tracker + report | R62d grep; tracker edits; report/ledger | 12 | Sweep run (≈150 hits ≈50 files, **not** liveness-triaged); tracker updated (R52/R56) |

**Approx. total: ~118 tool executions / 14 verdicts ≈ 8.4 calls per verdict** (43c baseline 9.6; target 6–7). Desk work (recon, tracker, report) is *excluded* from the device ratio per R71-fallback.

## Friction heat-map

| Class | Cost | Fix |
|---|---|---|
| Long-list Android scrolling to reach Load More (~16 calls for F08) | high | `qa:scroll-to` is a no-op on Android (R94); a working Android scroll-to-target primitive is still the top instrumentation ask |
| Stale screenshot frames + dev-client cold-start recovery | medium | re-poll before concluding; keep one Metro on :8081 |
| Workspace-scoped grep cannot read the AX session-resource file | low | use the terminal + absolute path (R105) |
| `qa:ocr` unavailable (Xcode licence) | low | AX-tree coords were sufficient; `qa:badge-scan` covered the colour leg |
| `qa:admin-config-set` default rewrites `data_type` | low | always pass `--data-type` |

## Standing-rule touchpoints used

R29 (busy check) · §4/R78-2 (precondition recon) · R7/§5.34 (one schema retry) · R30/R32 (AX-first modal) · R31/R22 (tab-bar band) · R107 (no AX-dump while pending) · R95/R106 (batch read/write timing; modals as their own step) · R108 (batched log read) · R104/R105 (tree over hand-read coords; absolute-path grep) · R62d/R62e (full-hex sweep; fills are scan targets) · R54/R11/R24 (§5.37 side-effect + numeric read-back) · R28 (scope-write → revert → verify) · R37/§5.44 (sanctioned config write) · R100 (name the writer before filing) · R103 (true-bottom before an absence claim) · R59/R96 (stale-after-backend-change / re-focus ≠ remount) · R80/R13 (named no-verdict set) · R52/R56/R57 (tracker update + count integrity) · R53/§8.3 (full handoff).
