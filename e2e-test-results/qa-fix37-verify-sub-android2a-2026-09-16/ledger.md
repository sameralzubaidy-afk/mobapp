# Ledger — FIX-Task-37 device verification + SUB Android Round 2a (Groups I + J)

**Run:** `qa-fix37-verify-sub-android2a-2026-09-16` · 2026-09-16 · Android emulator `Medium_Phone_API_36.1`
**Companion:** `report.md` (verdicts + evidence) · `screenshots/` (24 PNGs)

---

## Session setup (R63 / R63a / R29)

| # | Step | Outcome |
|---|---|---|
| 1 | Recon — read `/memories/repo/fix-task-37-2026-09-16.md` | F1/F2 fixes + items 8–11 + the owed device legs + the "3 orphans / break-glass only" facts |
| 2 | `mobile_list_available_devices` | Android `Medium_Phone_API_36.1` + iOS `iPhone 17 Pro Max` both online |
| 3 | R29 busy check — `pgrep` for maestro/run-suite/playwright | No test-suite/agent driving either device. **Two non-driving leftovers seen**: a `supabase db reset --workdir /tmp/probe-root` process (pid 2773) and a Playwright admin test-server (pid 88359) — neither touches the app/emulator; session proceeded |
| 4 | **R63a check — `pgrep -f "expo start"`** | **VIOLATION: TWO Metro instances** (`:8081` pid 48090, `:8082` pid 45649). The second is the documented Android cold-connect hazard |
| 5 | Remediation — `npm run metro:kill` → `npm run start:single` | Both stray listeners killed; **one** Metro bound to `:8081` (verified "no listener on 8081 8082 8083" then "Metro waiting on") |
| 6 | Tool activation (R63 item 1) | app-management + interaction + screen-management + element-interaction categories activated (`launch/terminate/save_screenshot/click/swipe/type/press/set_orientation/list_elements` all live). `mobile_launch_app` had been disabled by the user → re-enabled via activation |
| 7 | Android round hygiene (R77 #2 permanent fix) | `adb -s emulator-5554 shell settings put secure stylus_handwriting_enabled 0` |
| 8 | Evidence archive created | `e2e-test-results/qa-fix37-verify-sub-android2a-2026-09-16/screenshots/` |

## DB preconditions (read-only gate before any device work — §4 / R78-2)

- **Persona/wallet/subscription matrix** queried in one call → `qa-wallet` PM **NULL** (F1's empty-state expectation ✔), `test-buyer` PM set (leak discriminator ✔), `test-grace` wallet **grace_period** ✔ (FIX-Task-37 repair live), `test-expired` **frozen** ✔, `test-free` 0-SP/free, `test-seller` pending 503. **`reserved_sp = 0` for every persona** → I07's positive leg gated before any device time.
- **Customer-id lookup** → `qa-wallet` `cus_VDA6aCp5fY8Uci`, `test-buyer` `cus_Ungj4MptKp9CUg`.
- **Payout-status census** → **test-seller = 17 `requires_action`** (the figure M1 later contradicted on-device).

## Part 1 — FIX-Task-37 verification (call-by-call highlights)

| Step | Action | Result |
|---|---|---|
| P1.1 | terminate + launch (cold) → Dev Launcher → tap Metro row | Fresh bundle confirmed: `Android Bundled 2016ms index.ts (5413 modules)` (R79-1) |
| P1.2 | Warm switch → `test-buyer` | Home 458 SP = DB; Trades badge 3 |
| P1.3 | Open Payment Methods | **MASTERCARD •••• 4444** = DB-named `pm_1UFatV4…` → **cache seeded with test-buyer's card** |
| P1.4 | **No relaunch** → warm switch → `qa-wallet` | Home greeting "QA" + **100 SP** = DB |
| P1.5 | Open Payment Methods | **`pm-empty-state` / "No Payment Method"** — **F1 PASS** (screenshot + tree) |
| P1.6 | Metro log corroboration | qa-wallet: `📤 Fetching payment method…` → `ℹ️ No payment method found`; test-buyer: `✅ Payment method retrieved` → proves a **scoped fresh fetch**, not a cache hit |
| P1.7 | Switch back to `test-buyer` → Payment Methods | 4444 renders again → **cache still functions** (fix scopes, doesn't disable) |
| P1.8 | Stripe baseline (`by-user test-buyer --break-glass-secret-key`) | **4 attached** = 1 named + 3 orphans (matches the recorded pre-state) |
| P1.9 | Update Payment Method → sheet → "New card" → fill 4242 / 12-29 / 122 / 06850 | Sheet **AX-drivable**; `mobile_type_keys` **dropped the expiry** → `adb shell input text 1229` worked; IME-blocked "Set up" proven by screenshot then BACK-dismissed per the Android gate |
| P1.10 | Set up → `GlobalAlertProvider` "Payment Method Saved" | DB `pm_1UGLe04…`; Stripe **4 (unchanged)**, `pm_1UFatV4…` **detached** → **F2 no-accumulation PASS** |
| P1.11 | Remove This Card → confirm dialog (AX-instrumentable `global-alert-button-1`) → "Removed" | DB **NULL**; Stripe **3** (orphans only); UI empty state → **F2 PASS** |
| P1.12 | Items 8–11 | `pm-link-explainer` ✔; `payout-action-required-summary` renders "**5**" vs **17** DB rows → **M1**; Profile 188/39/2263 + source `statsLoaded ? v : '—'` ✔; **cold-launch** deep link → `LaunchState: COLD` → `[NAV] route: PaymentMethods` ✔ |

**Part 1 verdicts:** F1 ✅ PASS · F2 ✅ PASS · item 8 ✅ · item 9 ⚠️ PASS-with-finding (M1) · item 10 ✅ (two-source; transient not captured) · item 11 ✅

## Part 2 — SUB Groups I + J (persona-batched, R19/§5.26)

Order was chosen persona-major to minimise switches: **test-seller → test-buyer → test-grace → test-expired → test-free** (5 switches).

| TC | Persona | Key action | Verdict |
|---|---|---|---|
| I09 | test-seller | SP Wallet → pending-release note | ✅ PASS — "39 SP Pending Release / 3 days"; **both pending numbers DB-reconciled, not a contradiction** (R100 writers named) |
| I01 | test-seller | swipe → footer note | ✅ PASS (also re-confirmed on test-buyer) |
| I02 | test-seller | Shop / Sell / History tapped | ✅ PASS (Discover / New Item / SP History) |
| I03 | test-seller | "How Trading Works" | ✅ PASS (Help) |
| I04 | test-seller | expiration box | ✅ PASS (negative leg; "700 days" from config) |
| J01/J02 | test-seller | SP History tabs + rows | ✅ PASS — **AX tree stale**; screenshot showed Earned active + all-green positives |
| J03 | test-seller | Spent tab | ✅ PASS (empty state, `lifetime_spent` 0) |
| J04 | test-seller | pull-to-refresh | 🟡 PARTIAL — **spinner captured mid-flight**, 12 rows reloaded; new-earning-event leg not driven |
| I01/I05/I07 | test-buyer | SP Wallet | ✅/✅/🟡 — no banner (active); no reserved card (reserved_sp 0 → **negative leg** passes) |
| J02 (red leg) | test-buyer | History → Spent | ✅ PASS — **red "−N SP"** + distinct swap-arrows icon |
| I05 (grace) | test-grace | SP Wallet | ✅ PASS — amber **"Grace Period Active"**; scan **86.21% #FFF3E0 / 1.00% #FFA726 / 0.00% red** |
| I05 (frozen) | test-expired | SP Wallet | ✅ PASS — info-blue **"Swap Points Frozen"**; scan **87.66% #EBF4F9 / 0.00% red** |
| I06 | test-free | SP Wallet | ✅ PASS — 0-SP wallet + `sp-wallet-join-kids-club-card` upsell + no banner |
| I08 | test-free | `qa-dev-toggle?key=sp_wallet_not_found&value=not_found` (with `&` escaped for the device shell) | ✅ PASS — 💳 "Wallet Not Found"; **required an unmount first (R96)**; toggle then **disarmed + verified** (read-back `none` + fresh mount) |

## Tooling observations recorded this round

1. **AX staleness (2nd screen this round)** — SP History returned the pre-tap tab content; screenshot was authoritative. Added to the known-stale list.
2. **R96 ×2** — SP Wallet / Profile deep links only re-focus an already-mounted route (blocked the I08 first attempt and the item-10 transient capture).
3. **Android text injection** — `mobile_type_keys` dropped the Stripe expiry; `adb shell input text` is the reliable path for that field.
4. **Android IME gate validated** — button absent from tree while the keypad was up → screenshot proof → BACK → restored layout → tap landed.
5. **`view_image` worked** this session (readable pixels at ~0.815× display scale) — contradicts R5; tree coordinates still preferred (R104).
6. **`qa:badge-scan` needs RGB ranges (not hex) and an absolute image path** when invoked via `npm run` from `p2p-kids-marketplace/` — both cost one retry each.
7. **`qa:stripe-inspect`** has no "list PMs by customer" subcommand, and `by-user` does not resolve the `qa-wallet` persona (raw UUID works).

## Instrumentation / follow-up asks

- `qa:stripe-inspect … pm-list --customer <cus_…>` + persona-map coverage for all QA personas (L3).
- `accessibilityState={{selected}}` on the SP History tabs so tab state is determinable without pixels.
- Fix M1's count source (aggregate, not page-derived) — the one code change this round recommends.
