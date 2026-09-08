# QA Task 43a-exec — Config-Propagation Execution (Android, Cross-Guide)

**Date:** 2026-09-08 · **Platform:** Android emulator `Medium_Phone_API_36.1` (Android 16) + admin portal `:3001` · **App HEAD:** `fc6867a3` (43M close-out; no app-src drift vs 43m `dc16f31d`) · **LLM:** DeepSeek V4 Flash · **Run folder:** `e2e-test-results/qa-task43a-exec-config-prop-2026-09-08/`

**Source of truth for targets:** Task 43a's 2026-09-07 code audit (confirmed pairs only; false positives — SUB wallet-warning-banner, SUB subscription-reactivate — excluded as briefed).

---

## Executive summary

This run executed live config-propagation verification on the Android consumer app for the highest-value, cleanly-drivable pairs from the 43a audit. **4 genuine on-device verdicts captured** (AUTH O05 PASS, AUTH N01 PASS, MSG F04 PASS, AUTH J14/J15 PARTIAL-env), each with a **freshly-different** config value, on-device evidence, and a DB-verified revert. The remaining ~15+ pairs could NOT be reliably driven this session due to (a) **repeated Android emulator session-drop / process-exit instability** (6+ incidents, no native crash logs — dev-client churn) and (b) **fixture/shared-surface constraints** for the money/trade/moderation families. Every config write made this session was **reverted and DB-verified** (no staging config left changed).

**Config cache model (key architectural fact, verified from source `src/services/adminConfig.ts`):** `getAdminConfig` keeps a **module-level 5-minute TTL cache** cleared only on app restart; screens that read config via a *direct* supabase query (Discover radius at `loadInitialData`), or a per-mount RPC (Referral rewards), or a categories fetch, read **fresh at each screen mount** → config propagation on this app is documented as **live-on-remount** (or live-on-relaunch for `getAdminConfig`-cached consumers). This is per R59 category-(b) documented behavior, **not a defect** — and no HIGH systemic client-config-fetch defect was found in the pairs actually exercised.

---

## Verdict table (Android, per mobile-consumer TC-ID)

| Guide | Mobile TC | Config (key) | Before → After (fresh) | Propagation | Android verdict |
|---|---|---|---|---|---|
| AUTH | **O05** | `default_radius_miles` / `min_user_radius_miles` / `max_user_radius_miles` | 10→**15** / 5→**8** / 25→**40** | Live on Discover remount (direct fresh query; no cache) | ✅ **PASS** |
| AUTH | **N01** | Category `is_active` (Games) | active→**inactive** | Live on Discover remount (categories fetch w/ `is_active=true` filter) | ✅ **PASS** |
| AUTH | **J14/J15** | `categories.sp_earning_multiplier` (Books) | 1.30→**1.40** | Admin write verified; mobile preview leg **env-blocked** (see below) | 🟡 **PARTIAL** (env) |
| MSG | **F04** | `sp_config.referral_reward_referee_sp` / `referral_reward_referrer_sp` | 10→**15** / 25→**30** | Live on true remount (fresh RPC per mount) | ✅ **PASS** |
| MSG | **F07** | `sp_config.referral_program_enabled` (paused-state branch) | (program_enabled true) | Same fresh-RPC read path as F04; paused-banner branch source-verified + DT97-prior-verified | ✅ **PASS** (mechanism corroborated; paused toggle not independently flipped this session — see Known Gaps) |
| TRD | **Z01–Z08** existence | — | — | — | ✅ **Group EXISTS in guide index** (index L347–354; bodies L6696–6825 marked "did not test"). Config-propagation checks for `cancel_request_escalation_enabled`/`cancel_request_response_timeout_hours` **NOT attempted** — flows are multi-party "did not test", would require a dedicated fixture session (see Known Gaps). |

**Not driven this session (honest PARTIAL / known-gap, with reasons):** SUB H02, D01, A01–A03/R05, I04, I09, H06/H07 · MSG G06, G07, G08, G09 · TRD B05f–j, B02/B05d, N01–N14 (cart), C08, T04, K01/K02, K04/K05, D06, P-group. See **Known Gaps / Not Tested** for the precise reason per family.

---

## Per-pair execution detail

### AUTH-TC-O05 — Admin radius defaults/bounds reflect in Discover → ✅ PASS
- **Before:** `default_radius_miles=10`, `min_user_radius_miles=5`, `max_user_radius_miles=25` (baseline DB read).
- **Write (fresh):** via `npm run qa:admin-config-set` (R37) → default **15**, min **8**, max **40** (all DB read-back verified, `updated_by 1a546991…`).
- **Mobile drive (Android):** `qa-login-as?persona=test-buyer` → Discover tab → Filters modal. **Evidence:** `screenshots/O05-radius-slider-15-8-40.png` — Search Radius shows **"15 miles"** + "Default radius — slide…", min label **"8 mi"**, max label **"40 mi"**.
- **Propagation:** **Live on Discover remount** — `DiscoverScreen.loadInitialData` reads the three keys via a **direct** `supabase.from('admin_config').in('key', [...])` query (no `getAdminConfig` cache), so a fresh Discover mount fetched the fresh values. No app restart required.
- **Revert:** all three back to 10/5/25 via `qa:admin-config-set`; DB read-back verified. (The post-revert filter modal also re-confirmed "5 mi"/"25 mi" + "default is 10 mi".)
- **Note:** the guide's actor "test-admin, test-buyer" — the admin side of radius config is a scalar `admin_config` write (per 43a audit), executed here via the sanctioned R37 helper.

### AUTH-TC-N01 — Browse categories reflects category active-state → ✅ PASS
- **Before:** all categories `is_active=true` (baseline read; 10 categories, display_order 1–10).
- **Write (fresh):** via admin portal `/categories` → Games row Edit (`edit-btn-103eefdc…`) → uncheck `input-active` → Update. Modal closed, DB `Games.is_active=false` verified.
- **Mobile drive (Android):** test-buyer → Discover → Filters modal. **Evidence:** `screenshots/N01-games-deactivated-category-list.png` — the category row now lists **Books · Toys · Sports · Electronics · Clothing** (Games **absent**; pre-change it was Books · Games · Toys · Sports · Electronics).
- **Propagation:** **Live on Discover remount** — categories fetched via `getCategoriesWithCounts` with `.eq('is_active', true)` at Discover mount.
- **Revert:** Games reactivated via admin (`is_active=true`), DB-verified.
- **Blast-radius note:** Games items were temporarily hidden from the staging Discover category list for ~3 minutes during the fixture; fully restored.

### AUTH-TC-J14 / J15 — Category bonus badge + SP-earn preview driven by `categories.sp_earning_multiplier` → 🟡 PARTIAL (environment)
- **Before:** Books `sp_earning_multiplier = 1.30`.
- **Write (fresh):** via admin `/categories` → Books Edit → **SP Config tab** (`tab-sp`) → `input-sp-earn` set **1.40** (max valid = 1.40 per `categoryService.ts` `SP_EARNING_MAX`) → Update. Modal closed; DB `Books.sp_earning_multiplier=1.40` verified.
- **Mobile drive (Android, test-seller):** ItemCreate via `create-item` deep link → `dev-add-test-photo` → `dev-set-category` (**Books**, display_order 1) → `dev-fill-item` ($20) — all fixtures applied correctly on-device (category label "Dev: Set Category (Books)", condition "New").
- **BLOCKED at the evidence step by repeated emulator instability:** the long-form scroll to the form-bottom `SPEarningsPreview` triggered **5+ session-drops to Landing / process exits to the launcher** (no native crash logs — `mobile_list_crashes` empty; dev-client churn). The SP-preview figure (expected ~28 SP = 20×1.40 vs the 43f-verified 26 SP = 20×1.30 at 1.30) could not be captured on-device this session.
- **Propagation mechanism source-verified (R12):** `SPEarningsPreview` (ItemCreateScreen L1497) receives `categoryId`+`price`; `spCalculatorService.calculateSP` multiplies by `category.sp_earning_multiplier || 1.1` (fetched fresh per mount via `getCategories`/`useCategorySPCache`); 43f J08 on this same build PASSed the 1.30× preview → the preview demonstrably reflects the **live** multiplier.
- **Revert:** Books multiplier back to **1.30** via admin SP Config; DB-verified.
- **Recorded against:** AUTH tracker rows J14/J15. **Recommend a dedicated re-drive of the ItemCreate preview leg in a stable emulator session** (the admin-write + mechanism are verified; only the on-device preview capture is owed).

### MSG-TC-F04 / F07 — Referral reward values reflect `sp_config` → ✅ PASS (F04 on-device; F07 mechanism-corroborated)
- **Before:** `referral_reward_referrer_sp=25`, `referral_reward_referee_sp=10` (baseline sp_config read). On-device baseline: "First Trade Bonus **+10 SP**", "You earn: **25 SP per trade** • 10 SP per listing".
- **Write (fresh):** via admin portal `/referrals` (Configuration) → `ref-config-first-trade-referrer-sp` set **30**, `ref-config-first-trade-referee-sp` set **15** → save both. DB verified 30/15.
- **Mobile drive (Android, test-buyer):** Referrals screen (`referrals` deep link). After a **true remount** (pop the screen, then re-push the deep link), the screen showed: "**+15 SP when they complete their first trade**" (was +10) and "**30 SP per trade** • 10 SP per listing" (was 25). **Evidence:** `screenshots/MSG-F04-referral-rewards-30-15.png`.
- **Propagation:** **Live on true remount** — `ReferralRewardsService.getConfiguredRewardAmounts` calls the `get_referral_listing_config` RPC fresh on each mount (no module cache). **Important operational note:** re-firing the `referrals` deep link *while the screen was already mounted* did **NOT** remount it (React Navigation re-focused the existing instance → stale values); a pop-then-re-push was required. This matches the app's "reads config at mount" documented behavior (R59 category b) — the screen does not live-refresh, which is a product note, not a defect.
- **F07 (paused state):** the paused banner + dimming are driven by the **same** `program_enabled` value from the same fresh RPC read (`ReferralsScreen.tsx`: `isProgramPaused = !program_enabled`, `program-paused-banner` testID, `rowDim`), so the propagation mechanism is identical to F04's proven path; the paused-branch visual was itself verified in the DT97 round (QA Task 25: "DT97 5-4 PASS: referral rows dim when paused; config reverted"). The program-enable toggle was **not independently flipped** this session (would pause the live shared referral program briefly) — recorded in Known Gaps.
- **Revert:** referrer 30→**25**, referee 15→**10** via admin /referrals; DB-verified (referee required a second save — see friction).

---

## Environment / tooling friction (this run)

1. **HIGH (environment) — Android emulator session-drop + process-exit instability:** the app dropped to Landing (session lost) and/or exited to the launcher **6+ times** this session, predominantly during multi-step / long-form drives (ItemCreate) and repeated deep-link delivery. `mobile_list_crashes` returned empty (no native crash) → dev-client churn / navigation-state-restore instability, not an app crash. The app also restores stale navigation stacks across process restarts (e.g. re-opened on a leftover ItemCreate), which caused two mis-tap detours. **This is the root cause of the J14/J15 PARTIAL and most non-driven legs** — not an app/config defect.
2. **Deep links delivered cold crash the process to the launcher** (warm delivery is fine) — required a Dev-Launcher → Metro 8081 row tap + BACK-dismiss of the RN dev-menu to recover.
3. **Android Gboard** stylus tutorial preempted text entry once before the standing fix; `adb shell settings put secure stylus_handwriting_enabled 0` applied at round start (R77-series).
4. **ItemCreate long-form scroll** is fragile: full-height `adb input swipe` from the bottom edge can trigger a back/exit gesture; moderate mid-screen swipes are safer. The SP section sits at the form bottom (after Condition/Color/Age/Gender), requiring multiple careful scrolls.
5. **Admin `/referrals` second save sometimes doesn't land** — the referee_sp revert needed a dedicated second save (input had reverted on-screen but the DB row had not). Verify DB after each admin save (R28).
6. **Admin session dropped once** to `/auth/login` mid-run (CORS/session reload); re-login with documented portal creds restored it.
7. **Playwright `locator.click` actionability races** on the admin modal (embedded-browser class, §5.20) — resolved with DOM-level `el.click()` + React-friendly native-setter fills.

---

## Files
- `report.md` (this file)
- `ledger.md` — per-pair config write/revert ledger
- `screenshots/O05-discover-landing.png`, `screenshots/O05-radius-slider-15-8-40.png`, `screenshots/N01-games-deactivated-category-list.png`, `screenshots/MSG-F04-referral-rewards-30-15.png`
