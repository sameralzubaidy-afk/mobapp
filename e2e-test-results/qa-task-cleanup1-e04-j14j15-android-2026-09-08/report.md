# QA Task Cleanup-1 — AUTH-TC-E04 Android Re-Run + J14/J15 Re-Drive — Report

**Run folder:** `e2e-test-results/qa-task-cleanup1-e04-j14j15-android-2026-09-08/`
**Date:** 2026-09-08 · **Device:** `Medium_Phone_API_36.1` (Android 16, emulator-5554, 1080×2400 px)
**App:** `com.sameralzubaidi.p2pmarketplace` (expo-dev-client, Metro :8081). HEAD `49c63c0a` (includes FIX-Task-6; clean tree, cold-reloaded fresh bundle — R79-1).
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**LLM:** DeepSeek V4 Flash. Agent-Improvement-1 (R78) + R79-1 cold-reload + R77 Android discipline applied. **Exclusive single-task emulator access held for the whole session (confirmed — no concurrent dev-fix/QA task).**

## 1. Verdict roll-up

| TC | Verdict | Evidence |
|---|---|---|
| AUTH-TC-E04 (Android re-run) | ✅ **PASS** | Friendly inline rate-limit message + disabled Resend with live range-band countdown; no raw "Rate limit exceeded" Alert. Closes FIX-Task-6's last piece. |
| AUTH-TC-J14 (bonus category badge) | ✅ **PASS** | On-device Android: picker shows ⭐ bonus badge on Books/Toys/Electronics/Art & Crafts; Games/Sports/Clothing/Other/Shoes/Bookies show none. Form/SP-preview identifies Books as bonus ("1.35x multiplier for this category"). |
| AUTH-TC-J15 (SP earn/cap preview recalc) | ✅ **PASS** | Books multiplier set fresh to **1.35** → ItemCreate SP preview "~27 SP" (20×1.35), NOT the old cached 26 SP (1.30); buyer-cap line "Buyers can pay up to ~14 SP toward this $20 price" (Books cap 70%). Live propagation proven. |

No FAIL · No PARTIAL · No BLOCKED. **This closes 43a-exec's J14/J15 config-pending re-drive AND the original 4-item J14/J15/N01/O05 set** (N01/O05 already PASS in 43a-exec). **FIX-Task-6 fully closed (iOS-verified + now Android-verified).**

## 2. Part 2 — AUTH-TC-J14/J15 (admin config write → mobile live-propagation)

### Admin write
- **Baseline (DB read):** Books `sp_earning_multiplier = 1.30` (43a-exec revert held), cap 70%, bonus icon present, id `4b400d90-…`.
- **Fresh value:** **1.35**. Rationale: distinct from every prior-tested Books value (1.30 baseline via 43f/43m J08; 1.40 via 43a-exec) to prove live propagation not cached state. Note: the brief's suggested **1.45 is NOT settable** — `categoryService`/admin route `SP_EARNING_MAX = 1.40` (server + UI-enforced). 1.35 is the clean in-range fresh value (→ 27 SP at $20 vs 26 at 1.30).
- **Write path (transparency note):** the browser click tool was non-functional this session — never-stable actionability on EVERY element (Books Edit, SP-earn cell, filter button, top-bar Notifications — 7+ click/hover attempts + hover, even after a clean reload). This is a session tool regression, not an app issue. The write was therefore made via the admin portal's **own PATCH API endpoint** (`/api/admin/categories/[id]` — the exact route the SP-Config UI Save calls, with the same server-side 1.05–1.40 validation + service-role write). DB read-back verified after write. **No raw SQL write used.** Recommend filing the click-tool regression as a tooling follow-up.
- **Revert:** Books back to **1.30** via the same PATCH endpoint; DB read-back verified (`sp_earning_multiplier = 1.30`).

### Mobile drive (Android, test-seller)
- `qa-login-as?persona=test-seller` (fresh session, avatar "TS" — R79-1 discriminating check) → `p2pkidsmarketplace://create-item` → `dev-add-test-photo` (1 photo, Cover) → `dev-set-category` (Books, display_order 1 — confirmed on the real Category field "Books") → `dev-fill-item` ($20, condition New) → scrolled to the form-bottom `SPEarningsPreview`.
- **J15 evidence (`screenshots/J15-sp-preview-27sp-1.35x-buyer-cap.png`):** "You'll earn: **~27 SP**" · "**1.35x multiplier for this category**" · buyer-cap row "Buyers can pay up to **~14 SP** toward this $20 price with Swap Points". $20 × 1.35 = 27 (not 26). Live propagation proven on a fresh ItemCreate mount (category cache fetched the fresh DB value — no app restart needed, consistent with the live-on-remount model).
- **J14 picker evidence (`screenshots/J14-category-picker-bonus-badges.png`):** opening the real CategorySelectModal on Android (category-select-button tap) **is AX-drivable on Android** (this fullScreen RN Modal is NOT AX-exposed on iOS — a platform difference worth recording): the picker row list shows Books ⭐, Games (none), Toys ⭐, Sports (none), Electronics ⭐, Clothing (none), Art & Crafts (real bonus-badge icon), Other/Shoes/Bookies (none) — matching DB bonus set (multiplier > 1.10). The J14 "non-bonus shows no indicator" leg is verified in the same tree.
- **Residue:** none from the drive — the dev-fixture path never publishes or autosaves a draft (DB-verified: test-seller 0 new items / 0 new drafts this session). The J14/J15 form was left unpublished (guide only needs the preview state, not a publish).

## 3. Part 1 — AUTH-TC-E04 Android re-run (FIX-Task-6 last piece)

**Fresh signup** (throwaway): Alice dev-autofill → `qa.alice.17888977501027905@kidsmarketplace.test` (user `01c4d6f0-…`), phone `+12025550102311`, created 20:02:44Z → auto-navigated to the **standalone PhoneVerificationScreen** (the surface 43m's finding was on).

**Induction (real 60s cooldowns, wall-clock):**
| Send | Code row (UTC) | Outcome |
|---|---|---|
| #1 auto on OTP mount | `d4ca32f4` 20:02:49 | Code Sent (DEV Bypass) dialog → 60s cooldown label |
| #2 Resend | `10be4d0c` 20:04:14 | Code Sent (DEV Bypass) dialog → 60s cooldown label |
| #3 Resend | `2da6394c` 20:05:24 | Code Sent (DEV Bypass) dialog → 60s cooldown label |
| #4 Resend | **(none — rate-limited)** | **Friendly inline message + disabled countdown** |

**Verified behavior on the 4th send** (`screenshots/E04-rate-limit-friendly-message-59m.png` + AX tree):
- `otp-rate-limit-message`: **"Too many attempts. Please try again in 3600 seconds."** — friendly INLINE copy (not the pre-FIX-Task-6 raw `Alert('Error','Rate limit exceeded')` from 43m).
- `otp-resend-countdown`: **"Resend in 59m"** — Resend is disabled (replaced by the countdown label), formatted in **range-based bands** ("59m", NOT raw "3577s") — exactly the refinement requested after iOS verification; the `formatOtpCountdown` banding holds on Android.
- **No raw-code Alert dialog** (the 43m E04 copy finding is GONE).
- **DB:** only **3** `phone_verification_codes` rows — the 4th send was genuinely blocked server-side (3/hr-per-phone gate). Client + server agree.

**E04 Android verdict: PASS.** The 43m finding (raw copy + active resend) is resolved on Android by FIX-Task-6; the E04 guide expectation ("a message like 'Too many attempts. Try again in N seconds' appears and further sends are blocked until the window passes") is met.

## 4. Findings / notes

1. **[INFO — session tool regression, admin clicks]** The shared-admin browser's `click_element`/`hover` actionability check never passed on ANY element (even top-bar controls, after a clean reload) — the `/categories` UI could not be driven by clicks this session. The Books config write used the portal's own PATCH API instead (identical DB write + validation). Recommend re-checking click actionability in a future session; if persistent, file a tooling issue. (Not an app defect; no code change warranted.)
2. **[INFO — platform AX difference]** `CategorySelectModal` (fullScreen RN Modal) **is AX-drivable on Android** but not iOS — recorded for future picker-leg drives (J14 was fully on-device here).
3. **[INFO]** The 1.45 value suggested in the brief exceeds `SP_EARNING_MAX` (1.40) — 1.35 used instead (in-range, never-before-tested fresh value). No defect; config-range documentation note only.
4. **[INFO — env noise]** A transient "Error checking TOS acceptance: Gateway Timeout" inline error appeared on ItemCreate entry (staging network 504 on the TOS-check RPC) — non-blocking, dismissed, did not affect the preview capture. Not a defect.

## 5. App state left behind / residue
- **App left logged OUT at Landing** (E04 throwaway logged out via qa-logout).
- **No config left changed:** Books `sp_earning_multiplier` = 1.30 (baseline, DB-verified). No other writes.
- **No items/drafts created** by test-seller's J14/J15 drive (DB-verified 0/0). test-seller's 2 pre-existing drafts (43f/43g leftovers) untouched.
- **Throwaway (disposable):** `qa.alice.17888977501027905@…` (user `01c4d6f0`) — phone-unverified, no profile row; 3 `phone_verification_codes` rows for `+12025550102311` (harmless, will age out). Cleanup candidate if desired.
- No code modified. Metro 8081 left running (as found). Admin portal left at `/categories`.

## 6. Perceived load-time observations
All transitions (login-as → Home, Home → create-item deep link, signup submit → OTP screen, OTP resend dialogs) landed well under 2 s. The only long waits were the E04 60s resend cooldowns (intended app behavior, ~3 min total) and the signup/scroll transitions (~1-2 s each). No ≥3 s app-behavior transition flagged.

## 7. Call-count ledger (manual tally — R71 fallback)
Manual tally of tool executions this session ≈ **95-105** (rough split: recon ~15; Part-2 admin [incl. ~9 wasted click-timeout retries on the click-tool regression + 2 PATCH + 3 DB verifies] ~20; Part-2 mobile ItemCreate/picker drive ~25; Part-1 signup + 3×60s-cooldown OTP drive ~25; cleanup/DB ~10). Verdict-class items = 3 (E04, J14, J15) → **≈ 32-35 calls/verdict** — ABOVE the 43c 9.6 baseline and well above the "small cheap session" ideal. Drivers: (a) the admin click-tool regression (~9-12 wasted calls); (b) ItemCreate long-form scroll driving on Android (43a-exec-known class, ~8 scrolls/re-lists); (c) the signup form ScrollView friction (~6 calls); (d) E04's three mandatory real 60s cooldowns (~10 poll calls — structural, unavoidable). The pure verdict content (3 verdicts, 1 config write/revert) is genuinely small; the call cost is tooling + structural-wait overhead, not rework. Flagging per the brief ("flag if it isn't small").

## 8. Tracker
`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — AUTH rows E04 (Android re-run note, FIX-Task-6 confirm) + J14/J15 (config-pending → full PASS, live 1.35 propagation evidence) refreshed; see tracker update.
