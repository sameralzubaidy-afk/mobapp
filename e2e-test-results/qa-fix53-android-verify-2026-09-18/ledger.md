# Ledger — FIX-Task-53 Android Verification Leg (2026-09-18)

Ordered decision → action → outcome. Tool-call counts are approximate (manual tally — this session's
transcript debug-log was **not** mined with `qa:mine-call-ledger`; see R71-fallback).

## Phase 0 — Recon / gates (~14 calls)

| # | Decision | Action | Outcome |
|---|---|---|---|
| 1 | R29 busy check | `adb devices -l` | `emulator-5554` attached |
| 2 | R29/R77 #16 | `pgrep -l -f "expo start\|run-suite.sh\|maestro\|playwright"` | ONE `expo start` (PID 3620); a `playwright test-server` also running (admin-portal dev tooling, not an active run) |
| 3 | R63a | `lsof … \| grep 8081\|8082\|3001` | only `*:8081` LISTEN ⇒ single Metro ✅; :3001 not running (not needed) |
| 4 | Host health | `uptime` | 3.34 / 10.71 / 9.88 — healthy |
| 5 | Activate tool categories (R63 step 1) | 4 × `activate_*` | app-management, interaction, screen-management, element-interaction |
| 6 | Device id (R77 #17) | `mobile_get_foreground_app(device="Medium_Phone_API_36.1")` | ✅ AVD name works; app already foregrounded |
| 7 | Screen size | `mobile_get_screen_size` | 1080×2400 |
| 8 | Current screen | `mobile_save_screenshot` + `qa:ocr` | **already logged in as `test-grace`** (15 SP, "Grace Period Active", 54 days) |
| 9 | DB path probe | `mcp_supabase_execute_sql` | ❌ **401 UNAUTHORIZED** (same as FIX-Task-53) |
| 10 | Alternative DB path | `ls scripts/qa/`, read `start-state.mjs` header | ✅ `qa:*` scripts use the service-role key from `.env` via `lib/r41-common.mjs` — a read-only DB path EXISTS |
| 11 | **Bundle-freshness gate (R79-1b)** | `git log` + `ps -o lstart` Metro | commit `73426d4d` **06:25 TODAY** vs Metro **Sep 17 16:01** ⇒ loaded bundle **pre-dates the fix** ⇒ cold reload MANDATORY |
| 12 | Session plan | `memory create /memories/session/qa-fix53-android-plan.md` | recorded |

## Phase 1 — Cold reload + item 1 (~26 calls)

| # | Decision | Action | Outcome |
|---|---|---|---|
| 13 | Force fresh bundle | `mobile_terminate_app` → `mobile_launch_app` | Dev Launcher |
| 14 | Poll (screenshots only, R107) | `save_screenshot` → OCR `:8082`/`:8081` rows | Dev Launcher; **stale `:8082` entry present but nothing listening** |
| 15 | Resolve the row | `mobile_list_elements_on_screen` | `:8081` row @63,651 954×137 |
| 16 | Tap | click (540,720) | "Loading from 10.0.2.2:8081…" |
| 17 | Wait (batch no-ops) ×2, Metro CPU check ×2 | batches + `ps -o %cpu` | Metro idle (cached serve) — kept polling |
| 18 | Log probe | `mobile_get_device_logs(ReactNativeJS)` | empty → still loading |
| 19 | **Freshness confirmed by behaviour** | screenshot + OCR | Home as `test-grace`: SP strip **`15 SP`** (not the free-tier upsell) + banner **54 → 53 days** ⇒ fresh JS |
| 20 | Item-2 tooling validation + pre-state | `qa:start-state -- test-grace`; `qa:stripe-inspect -- by-trade 0ba80809…` | refused (full secret key) → re-ran `--break-glass-secret-key` → **`trades.sp_amount = 5`** ✅ (item 2 answered) |
| 21 | Discover | click `tab-discover` → list → grep | toggles OFF/OFF, 97 results |
| 22 | Apply filters (recipe §6.1) | click Show-All-Nodes (266,617) + SP toggle (882,480) → list | **94 results · all nodes**, both toggles `selected` |
| 23 | Pick a NON-colliding item (R15) | grep result ids | 1st card = the item carrying the existing pending offer ⇒ chose the **2nd** (`18a41ad8…`) |
| 24 | Evidence + open item | `save_screenshot A04` → click (797,1494) | Item Detail "QA Bundle Fixture 1 of 3" $28.00 |
| 25 | Request to Buy | click (540,2017) | Make Offer |
| 26 | **HARD ASSERT (item 1)** | `save_screenshot A05` + OCR + `list_elements` | **`sp-amount-input` PRESENT · `subscribe-upsell-card` ABSENT** ✅ |
| 27 | Disable Gboard stylus tutorial (R77 #2) | `adb shell settings put secure stylus_handwriting_enabled 0` | clean text entry |
| 28 | Enter SP | click `sp-amount-input` (555,1463) → `mobile_type_keys "5"` | field = 5, "5 SP applied", YOU OFFER $23.00 |
| 29 | **IME gate (R19)** | screenshot → proved keypad UP → `press BACK` → screenshot → proved keypad GONE | ✅ gate fully discharged |
| 30 | Re-derive before tap (R78-7) | `list_elements` | **layout HAD shifted**: `send-offer-button` y1980 → **y1854** (old coord would have missed) |
| 31 | Send Offer — its own step (R106) | click (540,1922) → list | `disclaimer-modal` AX-exposed; accept button **`disabled`** |
| 32 | Tick the checkbox (R30 + FIX-Task-27 Android lesson) | evidence `A08` → click the **square** (84,2107) → list | `checked` + accept no longer `disabled` |
| 33 | Accept & Continue | click (798,2285) | modal covers the tab bar ⇒ no pill-occlusion risk |
| 34 | Poll the submit (screenshots only) | batch delay → `A09` | **"Trade Initiated! … You saved $5.00 using SP! You have 10 SP available."** |
| 35 | View trade details | list → click (540,1444) → batch → `A10` | **timeline records "Swap Points Used: 5 SP"** ✅ · Trades badge 1→2 |

## Phase 2 — Item 2 + item 11 (~22 calls)

| # | Decision | Action | Outcome |
|---|---|---|---|
| 36 | DB-confirm the Android spend | `qa:start-state -- test-grace` | wallet **avail 15 → 10**, `state=grace_period` ✅ |
| 37 | Item 11 precondition check | `qa:start-state -- test-buyer` | `active` + `cancel_reason=too_expensive` + `period_end 2026-09-27` (future) ⇒ **qualifies** |
| 38 | Persona switch | `adb … qa-login-as?persona=test-buyer` | delivered warm |
| 39 | Verify switch (batches + OCR ×2) | screenshots | Trade Timeline errored ("Failed to load trade") — the trade belonged to `test-grace` |
| 40 | Dismiss the error dialog | `list_elements` → **tree BLIND (status bar only)** → per R-NEW-1 the screenshot showed a rendered screen ⇒ tree channel blind, app alive ⇒ `qa:ocr --coords` → measured `OK` (540,1306) → click | dismissed |
| 41 | **⚠️ R107 violation** | `list_elements` on the Trade Timeline while it was loading/errored | **dev client died** — `SIGSEGV` in `mobilecli.so → art::ti::AgentSpec::Attach → AttachAgent` (R87/R107 family, tooling) |
| 42 | Classify, don't guess (R87) | `mobile_list_crashes` + `mobile_get_crash` | confirmed the JVMTI-attach backtrace; **not app code** |
| 43 | Recover | list launcher → click `:8081` row (540,720) → batch polls → log probe | app loaded as **`test-buyer`** (458 SP — matches the DB) |
| 44 | Item 11 positive leg | `qa-subscription-status` deep link → batch → `B07` | **`Cancelled At (historical)`** ✅ |
| 45 | Confirm the rendering (R12) | grep `SubscriptionStatusScreen.tsx` | label is a single string (`:274`), conditional on `cancellationIsHistorical` (`:191`) |
| 46 | Characterise the render | `qa:ocr --coords` | label **wraps to 2 lines** (`Cancelled At` y1765 h35 + `(historical)` y1807 h38) → **LOW layout finding** |

## Phase 3 — Items 5 + 7 (~28 calls)

| # | Decision | Action | Outcome |
|---|---|---|---|
| 47 | Baseline for restore | `qa:start-state -- qa-payout-seller` | verified primary `acct_1UGm4A3qQXHDi0B9`, balance 5000¢ |
| 48 | Read the scenario list | grep `payout-fixture.mjs` | `none / single-verified / single-unverified / two / mixed`; **scenarios use SYNTHETIC account ids** ⇒ restore needs `express-complete --create --replace` |
| 49 | Item 5 state | `qa:payout-fixture -- methods --scenario single-unverified` | 1 row written |
| 50 | Login | `qa-login-as?persona=qa-payout-seller` → verify | "Good morning, QA", 0 SP (DB-consistent) |
| 51 | Open screen | `payout-settings` → batch → `C02` | method card = `acct_****_unv` + **"Onboarding required"** ✅ |
| 52 | Trigger the guard | list → click `request-payout-btn` (317,831) → batch → `C03` | **ordinary `Withdraw Funds` modal, NOT the guard** ❌ |
| 53 | Diagnose (R12) | grep + read `PayoutSettingsScreen.tsx` `:572/681/682/1292/343` | guard = `if (!primaryMethodId)`; `primaryMethodId` from the **server's** `primary_method`; `single-unverified` is `is_primary:true` ⇒ guard cannot fire |
| 54 | Avoid a destructive mis-tap | list → modal **not** in the tree ⇒ `qa:ocr --coords` → measured Cancel (322,1659) → click | cancelled; **$50.00 intact** (`C04`) |
| 55 | Item 7 state | `qa:payout-fixture -- methods --scenario none` | 0 rows |
| 56 | Force a re-fetch (R59/R92) | click Home tab → re-fire `payout-settings` → batch → `C05` | PAYOUT METHOD = **"+ Add Bank Account"** ✅ |
| 57 | Trigger the no-method guard | click (317,831) → batch with `listElementsAtEnd` | **`no-method-add-btn` (825×137) + `no-method-cancel-btn` (122×117) BOTH in the AX tree** ✅ |
| 58 | Evidence | `save_screenshot C06` | captured |
| 59 | Close | click Cancel (540,1495) — AX-exposed this time | dismissed |
| 60 | **Restore** | `qa:express-complete -- create --replace` | new verified `acct_1UGzIcKsNs2cG8fW`, `due=[]` |
| 61 | Verify restore | `qa:start-state -- qa-payout-seller` | verified PRIMARY, balance **5000¢** unchanged, payout row intact ✅ |

## Phase 4 — Item 11 negative leg + teardown (~10 calls)

| # | Decision | Action | Outcome |
|---|---|---|---|
| 62 | Negative-leg persona | `qa-login-as?persona=test-expired` → batch → `D01` | SubscriptionExpired ("plan ended on August 1, 2026") |
| 63 | Drive | `qa-subscription-status` → batch → `D02` | **plain `Cancelled At`, NO `(historical)`** ✅ — eligibility gate holds |
| 64 | Teardown | `qa-logout` | logged out |
| 65 | Tracker (R52) | read SUB section + rows; `multi_replace_string_in_file` + 1 structure fix | Round 10 note + D01/E04/G11 appends; G11 cell separators verified |
| 66 | Report + ledger | `create_file` ×2 | this folder |

## Ask-backs / follow-ups

1. **Fixture:** `single-unverified-nonprimary` / `unverified-no-primary` scenario for `qa:payout-fixture` (unblocks item 5).
2. **Tooling:** provision a real `rk_test_…` restricted read key so money rounds carry restricted-read-only evidence instead of break-glass.
3. **Dev-side check:** whether the `NoMethodModal#unverifiedMethod` branch is reachable in production at all (R79-2 dead-code class).
4. **Dev-side (optional, LOW):** the item-11 label wrap.
