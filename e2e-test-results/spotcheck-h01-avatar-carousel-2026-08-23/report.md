# QA Session Handoff — Spot-Check: H01 Avatar Fixture + Carousel Typo

- **Run date:** 2026-08-24 (00:24–00:33Z)
- **Device:** iPhone 17 Pro Max simulator (iOS 26.1), `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, Debug build + Metro (:8081)
- **Environment:** Staging (`drntwgporzabmxdqykrp`); fresh UI-created throwaway persona `new-user`
- **Scope:** Targeted 2-check spot-check (NOT a full Group H re-run) per QA brief.
- **Guide ref:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (AUTH-TC-H01, AUTH-TC-H06/H07 carousel)
- **Evidence:** `e2e-test-results/spotcheck-h01-avatar-carousel-2026-08-23/screenshots/`
- **Run type:** Fresh signup → Profile Setup (Check 1) → onboarding carousel slide 3 (Check 2)

---

## Test Scope

| Check | What was verified | Verdict |
|---|---|---|
| **1a — Avatar preview via `dev-set-avatar`** | Tapping the new `Dev: Set Test Avatar` fixture updates the avatar circle to the bundled test image (the previously toolset-limited sub-assertion). | ✅ **PASS** |
| **1b — Profile Setup completion** | Name + ZIP 06850 → resolves to Norwalk, CT → assigned to Norwalk Central node; profile completes (DB `profile_completed=true`). | ✅ **PASS** |
| **1c — Avatar persists → `avatar_url` populated** | Avatar survives to the profile record (DB read-back). | ❌ **NOT MET** (fixture-limited; see Critical Findings) |
| **2 — Carousel slide 3 typo** | Title now reads **"How You Earn PIPs (Pass It Up Points)"** — no typo, no stray space. | ✅ **PASS** |

**Bottom line:** H01's avatar-preview sub-assertion is now **unblocked and verified** (the fixture works for preview). However, H01 **cannot yet be marked fully PASS** end-to-end: the current fixture injects a Metro-served asset URI that fails the avatar upload at the ImageManipulator preprocess step, so `avatar_url` stays `null`. This is a **fixture limitation, not a production defect** (see Recommended fix).

---

## Verdict Summary

- **Check 1:** 2/3 sub-assertions PASS; the avatar-persistence sub-assertion NOT MET (fixture-limited).
- **Check 2:** PASS.

---

## Critical Findings

### F1 (dev-fixture limitation — NOT a production defect): `dev-set-avatar` preview works, but the fixture's URI cannot be uploaded → `avatar_url = null`
- **Observed:** After tapping `dev-set-avatar`, the avatar circle rendered the bundled image (proven: avatar-region pixel-diff 79.4% changed; color histogram went from gray-only placeholder `#6B6B6B`/`#F0F0F0` → green `#71AFA3`/`#7EC1A9`/`#91B2A9` = the adaptive-icon signature). On Complete Setup, a **Warning** dialog appeared: *"Profile will be created without avatar. You can add it later."* — the upload failed. DB read-back: `avatar_url = null`.
- **Root cause:** `ProfileSetupScreen.handleDevSetAvatar` sets `localImageUri = Image.resolveAssetSource(require('...adaptive-icon.png')).uri` — a **Metro dev-server asset URL**. `uploadProfileAvatar` → `ImageManipulator.manipulateAsync(imageUri)` fails to read that source → `❌ Avatar preprocess failed: Error: Calling the 're...` (LogBox) → the non-blocking warning branch runs. Confirmed **not** the H03 simulation toggle: `qa_avatar_upload_failure = none` (DB-verified, disarmed since 2026-08-18). The real-user path (expo-image-picker → `file://` URI) is unaffected.
- **Recommended dev fix (follow-up task, not applied — execution-only):** make the fixture produce an **uploadable `file://` URI** — e.g., copy the bundled asset to the app cache via `expo-file-system` and set `localImageUri` to that path — so the preview AND the upload/persistence leg both work. (Alternative: keep the fixture preview-only and verify `avatar_url` persistence by a separate seeded/storage-upload check.)
- **Doc note:** the H01 guide's own `Expected Result:` only asserts the preview updates + ZIP resolves + advance — which all pass. The `avatar_url`-populated assertion is the spot-check brief's extension.

### F2 (no defect — cleared) LogBox console error during Check 1
- A dev-build LogBox banner showed the avatar preprocess error (non-fatal). Cleared on relaunch; not an app-behavior failure of the case. No crash, no stuck state.

---

## Check-by-check trace (abridged)

**Check 1 (AUTH-TC-H01 avatar leg)**
1. Landing (clean, no session) → `landing-signup-button` → Signup.
2. `dev-fill-test-user-1` autofill (Alice) — generated fresh email `qa.alice.17875311421161451@kidsmarketplace.test`, phone `+12025552116176`, DOB 2000-01-15, passwords. Verified in-tree.
3. `signup-submit-button` → Phone Verification → auto-sent code → `dev-verify-otp-123456` ("Use & Verify") → Success → Continue → **Profile Setup**.
4. `dev-set-avatar` tapped → avatar circle updated (pre/post screenshot diff + color histogram). **1a PASS.**
5. Filled display name `H01 Spot Check Parent` + ZIP `06850` → `📍 Norwalk, CT` confirmed; keyboard dismissed (Cmd+K) → `complete-setup-button`.
6. Warning (avatar upload failed) → OK → **Success "Your profile has been created!"** → OK.
7. DB read-back: `name` set, `zip_code 06850`, `node_id = 550e8400-…-0001` **Norwalk Central**, `profile_completed=true`, `phone_verified_at` set, **`avatar_url = null`**. **1b PASS / 1c NOT MET.**

**Check 2 (carousel slide 3)**
8. Post-setup → onboarding carousel (slide 1) → swipe left ×2 → slide 3.
9. Full-frame + tight-crop OCR of the title band: **"How You Earn PIPs (Pass It Up" / "Points)"** — `Points` (not `Pionts`), no stray space inside parens. **2 PASS.** Source `src/data/onboarding-screens.ts` (line 38) matches; fix commit `f4d3de8e` (`fix(onboarding): … carousel typo, dev avatar fixture`) confirmed via `git log`.
10. Cleanup: terminate + relaunch (cleared LogBox; session persisted, carousel restored) → Skip → **Home** with tab bar mounted immediately (no Phase-24 tab-bar regression), `Norwalk Central` header. DB: `onboarding_skipped_at` set 00:32:48Z.

Perceived loads (simulator, wall-clock, ±polling-interval precision — not a formal profile): all transitions < 3s; no ≥3s flags.

---

## Design-System Compliance

- **Profile Setup:** primary `Complete Setup` pill green (`#5DBB8E` class), filled inputs, avatar circle present — consistent with `design-system-passitup.md`. No deviations.
- **Dialogs (Warning / Success):** in-app `GlobalAlertProvider` dialogs (buttons surfaced as `global-alert-button-0`), white surface, single OK primary, correctly worded parent-facing copy. No deviations.
- **Onboarding carousel:** slide 3 title + body render cleanly; progress dots green-active. No deviations.

---

## App State Left Behind

- **Persona (throwaway):** `qa.alice.17875311421161451@kidsmarketplace.test` (user `8dba7348-ee7b-4182-a52f-a72662f5b145`) — phone-verified, profile **completed** (`name` "H01 Spot Check Parent", ZIP `06850`, node **Norwalk Central**), `avatar_url = null`, onboarding **skipped** (00:32:48Z). Logged in at Home. **Cleanup candidate** (throwaway, as with other per-run new-user accounts).
- No shared persona state was modified.
- App left on Home (tab bar visible); simulator clean.

---

## Why It Matters

The avatar-preview leg of H01 was the last open toolset-limited piece of Group H (the undrivable native photo-picker crop editor). This spot-check proves the `dev-set-avatar` fixture **does** unblock that leg — the preview sub-assertion is now toolset-verifiable and passes. The remaining `avatar_url`-persistence gap is a fixture-URI upload limitation that a small dev fix (file:// URI from the cache) closes; it does not indicate a production avatar-upload regression.

---

## How to Verify / Reproduce

1. Fresh signup (autofill Alice) → phone verify (`123456`) → Profile Setup.
2. Tap `Dev: Set Test Avatar` → avatar circle shows the bundled image (screenshot-diff the avatar region; expect ~80% changed pixels + green signature).
3. Fill name + ZIP `06850` → submit → Warning → OK → Success → DB `profiles.avatar_url` (expect `null` on the current build).
4. Carousel → slide 3 → confirm title "How You Earn PIPs (Pass It Up Points)".

---

## Known Gaps / Not Tested

- `avatar_url` **populated** end-to-end not achievable with the current fixture (F1). Once the dev fix (file:// fixture URI) lands, re-run 1c only.
- Real camera/picker avatar upload path not exercised (native crop editor is undrivable by the toolset — unchanged).
- No other Group H cases re-run (out of scope for this spot-check).

---

## Suggested Next Session

- After the F1 fixture fix, re-run **Check 1c** (avatar persistence → `avatar_url` non-null) to close H01 fully.
- Optionally verify the full H01 assertion set + H03 toggle re-check in a single Group H closure run.

---

## Suggested to Improve Agent Rules

- The known-undrivable-native-modal list (§5.31) can now note the dev avatar **preview** is unblocked via `dev-set-avatar`, but the fixture's **upload** path still needs a file:// URI — a follow-up memo for the fixture author.
- Add a note to the H03 toggle registry: current state confirmed `none` (2026-08-24), matching the last recorded disarm.
