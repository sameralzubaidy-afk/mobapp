# Group J+H Closure — Final Verification Run Report

- **Date:** 2026-08-24 (wall-clock 15:36 → 15:58 EDT ≈ 22 min)
- **Device:** iPhone 17 Pro Max sim (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), debug build + Metro
- **Guides:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — AUTH-TC-J05 (Group J, L1104–1118), AUTH-TC-H01 (Group H, L930–945)
- **Checks:** 1) J05 "Other" category custom-name flow via `dev-set-other-category` fixture; 2) Post-migration `item_drafts.photo_urls` sync after `merge_item_draft` fix; 3) H01 avatar persistence via fixed `dev-set-avatar` cache-URI fixture
- **Personas:** test-seller (Check 1 + 2); fresh UI signup `qa.alice.17876013524609211@…` (Check 3)
- **Login/logout cycles:** 1 login (test-seller), 1 qa-logout, 1 fresh signup. Final state: fresh H01 user logged in at Home.

---

## Batch summary

| Check | Guide | Verdict | Top finding |
|---|---|---|---|
| Check 1 — J05 | Group J | **PASS** | `dev-set-other-category` prefills "Board Games"; clearing the field → submit gray `#C8C8C8` (blocked); re-fill → green `#5DBB8E`. **Group J now 14/14.** |
| Check 2 — photo_urls sync | Post-migration | **PASS** | Draft `667898b8` (3 photos, reordered) has `photo_urls` column == `draft_data->'photo_urls'` (`in_sync=true`); 46/46 drafts in sync, 0 stale rows (backfill confirmed). |
| Check 3 — H01 avatar | Group H | **PASS** | `dev-set-avatar` (cache-URI fix) → no "Profile will be created without avatar" warning; DB `avatar_url` non-null (`avatars/…jpg`) for completed profile. **Group H now 7/7.** |

**Roll-up:** 3 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED

### Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)
| Screen → transition | Elapsed | Flag |
|---|---|---|
| Landing → Login | ~1s | — |
| Login → Home (test-seller) | ~1–2s | — |
| Home → ItemCreate (deep link) | ~1s | — |
| App terminate+relaunch → Home (dev bundle) | ~10–15s (bundle download) | dev-build cold-start artifact |
| ItemCreate → Home (back nav) | ~1s | — |
| Signup → OTP (Create Account) | ~2s | — |
| OTP → Profile Setup (verify) | ~2s | — |
| Complete Setup → Success dialog | ~2–3s | — |
| Success OK → Onboarding carousel | ~1s | — |
| Skip → Home | ~1s | — |

No user-flow transition ≥ 3s (the relaunch is a dev-build bundle-load artifact). Perceived Load-Time Verdict: **GOOD**.

---

## Per-check details

### Check 1 · AUTH-TC-J05 "Other" category custom-name flow — PASS
- **Trace:** login test-seller → deep link `p2pkidsmarketplace://create-item` → `dev-add-test-photo` (1/10, form renders) → **`dev-set-other-category`** → tree: `custom-category-name-input` value **"Board Games"** + helper "This custom category will be sent to admin for review." → `dev-fill-item` (title "QA Dev Fixture Item", price 20, condition New; submit histogram **`#5DBB8E` green**) → **cleared the field** (long-press → Select All → **Cut**) → placeholder "e.g., Board Games" shown → submit histogram **`#C8C8C8` gray (blocked)** → re-typed "Board Games" → submit histogram **`#5DBB8E` green again**.
- **Assert:** prefill ✓; helper text ✓; submission blocked while custom name empty (even with all other fields valid) ✓; unblocked when provided ✓. All three states color-histogram-proven (179431 px green / 179534 px gray).
- **UX:** helper copy plain and parent-appropriate; `canPublish()` gating source-corroborated (`!isOtherCategory || requestedCategoryName.trim().length > 0`). Design tokens: enabled `#5DBB8E`, disabled `#C8C8C8` — match `design-system-passitup.md`.
- **Note:** field-clearing used the native text menu (Select All → Cut); `type_keys("\b")` writes a literal backslash-b (not a backspace) — recorded as a tooling fact.

### Check 2 · Post-migration `item_drafts.photo_urls` sync — PASS
- **Preconditions (DB-proven):** migration `20260824190740_fix_merge_item_draft_sync_photo_urls` **applied + tracked**; `merge_item_draft` function body contains the `photo_urls` column refresh (pg_get_functiondef confirmed); baseline **0 stale rows, 46/46 in sync** → the idempotent backfill left no drift.
- **Trace:** fresh ItemCreate → `dev-add-test-photo-uploaded` ×3 (mock-URL photos; each triggers the AI analyzing overlay → dismissed via "Continue Without AI") → removed one non-uploaded photo that slipped in, re-added → **3 uploaded photos** → DB: new draft `667898b8` `photo_urls` == `draft_data->'photo_urls'` = […1093661, …1129292, …1175644] → **reordered on-device** via `move-photo-right-…1129292` (J13 reorder control now present) → on-screen order [1093661, 1175644, 1129292] → back-nav flush (`saveNow`) → DB read-back: `photo_urls` = [1093661, **1175644**, 1129292] == `draft_data->'photo_urls'`, **`in_sync = true`**.
- **Assert:** column matches draft_data after a reorder ✓ (previously drifted); backfill end-state: 0 stale rows across all 46 drafts ✓.
- **Bonus verified:** the J13 reorder/replace fix is now implemented (`PhotoUploadManager` renders `move-photo-left/right-<id>` + `replace-photo-<id>`, previously a spec gap); `dev-add-test-photo-uploaded` unblocks the J02/J11 draft/AI paths (AI analyzing overlay observed on-device).

### Check 3 · AUTH-TC-H01 avatar persistence — PASS (Group H fully closed)
- **Trace:** qa-logout → fresh UI signup (`dev-fill-test-user-1` autofill, unique email/phone) → OTP DEV bypass `123456` (Use & Verify) → Profile Setup → **`dev-set-avatar`** (cache-URI fixture) → avatar preview rendered (teal logo colors in avatar circle region via histogram) → filled name "H01 Avatar Persist" + ZIP `06850` (→ "📍 Norwalk, CT") → **Complete Setup** → dialog was **"Success / Your profile has been created!"** (NOT the "Profile will be created without avatar" warning) → OK → onboarding carousel → Skip → Home.
- **DB read-back:** profile `3a98fe7b-3c33-493c-ba10-af6ec7dc61b7` — name "H01 Avatar Persist", **`avatar_url` = `avatars/f9edb222-f7d0-4a1d-bff1-d837800d955b-1787601486277.jpg` (non-null)**, `node_id` Norwalk Central `550e8400-…`, `zip_code` 06850, `profile_completed=true`, phone verified.
- **Assert:** no avatar warning ✓; avatar persisted (`avatar_url` non-null) ✓ — the one open H01 sub-assertion is now MET.
- **Also confirmed:** onboarding carousel slide 3 title reads "How You Earn PIPs (Pass It Up Points)" — the earlier typo fix holds; Skip → Home with tab bar present (Phase 24 bug remains fixed).

---

## Cross-cutting findings

- **J13 reorder fix confirmed:** the reorder controls (`move-photo-left/right-<id>`) that were a spec gap in the prior Group J run are now rendered and functional — the reorder exercised in Check 2 is direct evidence.
- **J02/J11 unblocked:** `dev-add-test-photo-uploaded` now drives the `uploadedPhotoUrls`-gated paths (AI analyzing overlay observed; draft auto-save created a real row). These were previously BLOCKED fixture gaps.
- **Design-system compliance:** submit button enabled/disabled states (`#5DBB8E`/`#C8C8C8`), SP preview text, and dialog colors on all visited screens match `design-system-passitup.md`. Dev fixtures are `__DEV__`-gated (not production).
- **Copy:** "This custom category will be sent to admin for review.", "e.g., Board Games" placeholder, and the OTP/avatar success copy are all clear and parent-appropriate. No rewrites proposed.

## Friction vs operating rules

1. **ItemCreate ScrollView flaky-scroll (toolset):** swipes snapped between two extremes (top ↔ Condition/Colors), skipping the custom-category field band; **terminate + relaunch did NOT fix it this run** (unlike Group J). Resolved by starting the swipe **over the photo grid** (non-button surface) instead of over the dev-fixture buttons — a new workaround for this class.
2. **`type_keys("\b")` is literal:** backspace escape isn't interpreted; field-clearing required the native text menu (long-press → Select All → Cut).
3. **`dev-set-other-category` + dev-fill-item coordinate sensitivity:** the first `dev-fill-item` tap at the reported center missed (pinned footer overlap); re-tapping at the button's upper area worked. Noted for the fixture.
4. **save_screenshot intermittent "tool does not exist" errors** — retried successfully (tooling flake, not data loss).

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-J05 (Check 1), post-migration photo_urls sync (Check 2), AUTH-TC-H01 avatar persistence (Check 3)
**Design-System Compliance:** PASS — no production deviations found. Submit button enabled `#5DBB8E` / disabled `#C8C8C8` (verified via pixel histograms on ItemCreate), SP surfaces, dialog colors, and the Profile Setup screen all match `design-system-passitup.md`. Dev fixture buttons are `__DEV__`-gated.
**Perceived Load-Time Verdict:** GOOD — all user-flow transitions < 3s (Login→Home ~1–2s; Create Account→OTP ~2s; Complete Setup→Success ~2–3s; Success→Onboarding ~1s; Skip→Home ~1s). The only ≥3s observation was the app relaunch (~10–15s), a dev-build bundle-download artifact, not an app-behavior issue.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ItemCreate "Other" flow: "Custom Category Name *" label, placeholder "e.g., Board Games", helper "This custom category will be sent to admin for review." — wording and layout match the design system.
- CONFIRMED — Submit for Review button: disabled gray when the custom name is empty, enabled green when provided — matches design-system disabled/primary tokens.
- CONFIRMED — Profile Setup: avatar preview, "Complete Your Profile" form, "Success / Your profile has been created!" dialog — clear, parent-appropriate copy, no deviations.
- CONFIRMED — Onboarding carousel: slide 3 "How You Earn PIPs (Pass It Up Points)" (typo fix holds), Skip → Home with tab bar.
**Verdict Summary:** 3 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED
**Critical Findings:**
1. **None — all three checks pass.** Group H (7/7) and Group J (14/14) can both be marked **fully closed**.
2. Note (not a defect): `merge_item_draft` sync + backfill are live on staging (0 stale rows across 46 drafts) — no further action needed.
**App State Left Behind:**
- test-seller draft **`667898b8-74c9-4b5b-9c71-8a44bc2dbf62`** (3 photo URLs, reordered [1093661, 1175644, 1129292], step "details") — created this run; **cleanup candidate** (like the pre-existing `466c440d`/`0a8d54b8` drafts from the dev fixture verification).
- Fresh H01 user `qa.alice.17876013524609211@kidsmarketplace.test` (profile `3a98fe7b`, "H01 Avatar Persist", avatar_url set, node Norwalk Central) — logged in at Home; **cleanup candidate**.
- test-seller was logged out (qa-logout) and left logged out; no items created; no other data created.
**Why It Matters:** This run closes the two longest-open verification threads. J05 proves the "Other" category custom-name gate is end-to-end correct (prefill, blocked-submit, unblock). The photo_urls sync proves the `merge_item_draft` migration fixed the column/draft_data drift that `publishDraft` reads directly. H01 proves the avatar persistence leg that was open since the original Group H run — the cache-URI fixture fix made the full avatar pipeline work, and `avatar_url` is non-null in the DB.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/group-j-h-closure-2026-08-24/screenshots/` (J05-*, C2-*, H01-* prefixes). Reproduce J05: login test-seller → deep link `create-item` → `dev-add-test-photo` → `dev-set-other-category` → `dev-fill-item` → clear the custom name → submit turns gray; re-fill → green. Reproduce Check 2: fresh ItemCreate → `dev-add-test-photo-uploaded` ×3 → `move-photo-right-…` → back → `SELECT photo_urls, draft_data->'photo_urls' FROM item_drafts` shows equal arrays. Reproduce H01: fresh signup → OTP bypass → `dev-set-avatar` → name + ZIP 06850 → Complete Setup → "Success" dialog (no avatar warning) → profile `avatar_url` non-null.
**Known Gaps / Not Tested:** None for these three checks. (No Android/admin — out of scope.)
**What Needs To Be Fixed Next:** None — all reachable behavior in this batch is correct. (Optional dev cleanup: delete draft `667898b8` and the H01 throwaway user if a clean baseline is wanted for future J/H re-runs.)
**UX Enhancement Ideas (optional, not defects):** None this run — no friction or enhancement opportunities observed beyond what's already noted above.
**Suggested Next Session:** Group K (Bulk Listing) — same listing-creation family, and the reorder/AI/draft fixtures unblocked this run are directly reusable; or re-verify J11/J02 (draft resume + AI) now that `dev-add-test-photo-uploaded` drives those paths on-device.
**Suggested to Improve Agent Rules:** When the ItemCreate-style ScrollView shows binary-snap swiping (top ↔ mid-section) and the swipe is started over dev-fixture buttons, retry the swipe **starting over a non-button surface (e.g. the photo grid)** before falling back to terminate+relaunch — this resolved the skip-band scroll this run where relaunch did not.
