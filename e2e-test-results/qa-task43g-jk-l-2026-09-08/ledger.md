# QA Task 43g — Group J Completion + Group K — Ledger

**Date:** 2026-09-08 · **Platform:** Android `Medium_Phone_API_36.1` · **Guide:** AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md · **HEAD:** 804b606c

| # | Case | Guide | Persona | Verdict | Evidence | Notes |
|---|---|---|---|---|---|---|
| 1 | AUTH-TC-J02 | Group J | test-seller | ✅ PASS | J02-0..4 | AI analyzing overlay + Continue Without AI + error card + Try Again re-trigger; Apply All/per-field Use source-corroborated (no dev mock) |
| 2 | AUTH-TC-J11 | Group J | test-seller | ✅ PASS | J11-1..7 | Draft `0b0063e2` auto-saved (DB); Dashboard resume banner → Continue → title+photos restored; junk-text bug FIXED |
| 3 | AUTH-TC-J12 | Group J | test-seller | ✅ PASS | J13-2 | 10MB/MIME/400px source/doc-verified; valid real image picked+uploaded via drivable Android Photo Picker |
| 4 | AUTH-TC-J13 | Group J | test-seller | ✅ PASS | J13-1..3 | Remove 2→1; reorder moved cover; replace COMPLETED via real picker + real storage upload (DB photo_urls); resume restores order |
| 5 | AUTH-TC-J07 | Group J | test-free | ✅ PASS | J07-1 | Free upgrade prompt "🌟 Subscribe…" + Upgrade Now (sp-upgrade-button); no sp-toggle |
| 6 | AUTH-TC-J10 | Group J | test-free | 🟡 PARTIAL | J10-1..4 | Gate VERIFIED (modal blocks unverified publish, no item created); completion leg gated — Send Code not firing + prefilled number mismatch (+1 (555) 123-4567 vs 5551234004) |
| 7 | AUTH-TC-K01 | Group K | test-seller | ✅ PASS | K01-1 | dev-add-test-photos → 5 auto-grouped items (dup-hash not exercisable — fixture) |
| 8 | AUTH-TC-K02 | Group K | test-seller | ✅ PASS | K02-1..2 | Long-press select → merge 2 photos into 1 item (Split + reorder controls appear) |
| 9 | AUTH-TC-K03 | Group K | test-seller | ✅ PASS | K03-1..2 | Step indicator Photos→Group→Review "current" progression |
| 10 | AUTH-TC-K04 | Group K | test-seller | ✅ PASS | K04-1 | Apply-to-All bar + "Apply Condition new" chip (fills-blanks source-corroborated) |
| 11 | AUTH-TC-K05 | Group K | test-seller | ✅ PASS | K05-1 | "Submit 4 Items" + confirm sheet opened (4 rows) + Confirm → "Missing bulk session" caveat alert (fixture); **tracker PARTIAL→PASS** |
| 12 | AUTH-TC-K06 | Group K | test-seller | ✅ PASS | K03-2 | Subscriber bulk-sp-summary card renders (Included 4 / SP-enabled 0 + Cash-Only guidance); numeric total needs per-card Accept-SP (fixture-gated) |

**Roll-up: 11 PASS / 1 PARTIAL / 0 FAIL / 0 BLOCKED / 0 SKIPPED** (Part 3 Group L L01–L04 deferred — see report §10).

## App state left behind
- All personas logged OUT; app at clean Landing (screenshot FINAL-landing-clean).
- **test-seller:** 2 active `item_drafts` (cleanup candidates): `0b0063e2-db7b-469e-a7fe-5f04ea9994b7` (this round: title "QA Dev Fixture Item", photo_urls [real storage photo, dev mock]) + `dd3dbdde-e4df-4b51-ac24-2722888aeb36` (43f leftover). Both expire 2026-09-15; discard via My Listings → Drafts or dev cleanup.
- **Group-L fixture intact:** item `73670a8f-b911-4c81-8542-4e15a997992f` "QA Dev Fixture Item" still `pending`, $20, accepts-SP (untouched).
- **test-free:** no items, no drafts, **phone still unverified** (J10 gate held; no mutation). J07/J10 drove with dev photos only.
- No `admin_config` writes; no session toggles armed. One real photo uploaded to storage (`item-images/drafts/14be337c…/photo_0_1788870147866.jpg`) as the J13 replace leg — orphaned within the draft (draft not submitted).

## Tooling/friction notes (for playbook/memory)
1. **Gboard handwriting tutorial** ("Try out your stylus") recurs on every field focus on this emulator (only LatinIME + voice IMEs present). Intercepts taps/text until BACK-dismissed. Recommend noting per-emulator-IME (extends R77 #2) — this emulator's flavor is the handwriting tutorial, not just "Allow Gboard to record audio?".
2. **Android system Photo Picker is AX-drivable this build** (select photo + Done) — replaces the prior §5.31 "picker-gated" assumption for Android on this build. J13's replace completed end-to-end.
3. ItemCreate ScrollView erratic/teleport scroll on Android — anchored `adb shell input swipe` (long, from lower screen) was the reliable scroll method (mobile-mcp center swipes often no-op'd).
4. J10 phone-gate modal prefilled `+1 (555) 123-4567` while test-free's `profiles.phone` = `5551234004` — worth a dev look (number source in the modal).
5. mobile-mcp tool-category activations repeatedly dropped mid-session ("disabled by user") — re-activation pattern confirmed again (R4 class).
