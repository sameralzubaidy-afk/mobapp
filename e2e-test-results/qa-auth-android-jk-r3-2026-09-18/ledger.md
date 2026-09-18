# QA Task — AUTH Android R3 (J/K residuals) — LEDGER

**Date:** 2026-09-18 · **Platform:** Android `Medium_Phone_API_36.1` (emulator-5554), 1080×2400 px · **Guide:** AUTH (Group J) · **HEAD:** `e715003e` (last app-code commit `40c1280f`) · **Metro:** `:8082`
**Round type:** completion of R2's 5 named residuals — J02 / J11 / J12 / J13 / J15 price re-type (R2 re-verified the other 16 J/K cases)

## Verdict table

| # | TC-ID | Group | Persona | Verdict | Evidence | Notes |
|---|---|---|---|---|---|---|
| 1 | AUTH-TC-J11 | J | test-seller | ✅ **PASS** | `J11-01..03` | Photo + partial details + leave → Dashboard `resume-draft-banner` **"You have 1 unfinished listing"** + "Continue where you left off" + `…-resume-button`; baseline was a **verified 0** (all 5 pre-existing drafts expired) ⇒ attributable. Continue → draft reopened with **photos restored (2/10, Cover at slot 0 = `restored-photo-0`)** **and title "QA Dev Fixture Item"** restored. **DB:** `item_drafts.155a5c44…` `expires_at 2026-09-25` (7-day TTL) |
| 2 | AUTH-TC-J13 | J | test-seller | ✅ **PASS** | `J12-01`, `J13-01..03`, `J11-02` | **Remove** → count updated **immediately** to (2/10), tapped id `…-1` gone · **Reorder** ("move earlier" on #2) → slot 0 holds `…-2` + **Cover badge moved** (lead photo changed) · **Replace** (⟳ on slot 1) → slot **kept**, new photo id, **real new upload** `photo_0_1789742981692.jpg` (5,564 B, 14:49:51Z), new image visible in-slot · **Persist:** leave → resume → **(2/10)** with Cover at slot 0 + title restored. **DB:** `photo_urls` = [`…/1789742746143/photo_2…`(reordered cover), `…/1789742981692/photo_0…`(replacement)] — removed photo **absent**, order preserved |
| 3 | AUTH-TC-J12 | J | test-seller | ❌ **FAIL** | `J12-01`, `J12-02` | **Limb 1 ✅:** 3 valid 720×720 PNGs in ONE real-Picker multi-select → **(3/10 photos)**, 3 distinct thumbs, Cover badge, ✕/◀▶/⟳ per photo, form unlocked, footer appears; **storage closure:** 3 objects 14:45:51–52Z (42,911 / 14,465 / 8,974 B — distinct sizes). **Limbs 3+4 ❌ (report F1):** selecting the **37.5 MB PNG** + the **GIF** (both selectable; GIF tile carries a "GIF" badge) → count **(4/10 photos)**, two new slots + full controls, and **NO error of any kind shown** (no Alert/toast/inline/banner; AX tree immediately after showed only normal form elements) — the unsupported file **is added to the listing**, contradicting the guide; **zero** new storage objects (validatePhoto rejects before upload, 42,911→unchanged set). Root cause: `ItemCreateScreen.uploadPhotos()` only `captureException`s `result.errors`; no user-facing branch. Second limb **source-traced (not driven):** publish passes `photos.map(p=>p.uri)` (all strip photos) to `uploadListingImages()`, which validates neither size nor MIME. **Limb 2 🟡 PARTIAL:** count driven 0→3→2→4 and cap copy renders ("Add up to 10 photos", "(N/10 photos)"); the 10-cap `Alert('Limit reached','You can add up to 10 photos.')` was not triggered (would need ~3 more picker round-trips) — code path source-verified, J01/R2 already passes the cap text |
| 4 | AUTH-TC-J15 | J | test-seller | ✅ **PASS** | `J15-01..04` | **Games (standard) @ $20** → "~**22 SP**" + "**1.10x multiplier**" + cap "~**14 SP** toward this $20 price" (20×1.10=22 ✓, 20×0.70=14 ✓) · **explicit price RE-TYPE** (CTRL+A + typed `30`, value verified "30") → "~**33 SP**" + "1.10x" + "**~21 SP** toward this **$30** price" (30×1.10=33 ✓, 30×0.70=21 ✓, cap line's own price text updated) · **bonus switch (Books)** → "~**39 SP**" + "**1.30x multiplier**" (30×1.30=39 ✓) = genuine uplift vs 33 · **switch-back (Games)** → "~**33 SP** / 1.10x" (uplift removed, recalculated live). Seller-earn **and** buyer-cap both render + disclaimer |
| 5 | AUTH-TC-J02 | J | test-seller | 🟡 **PARTIAL** | `J02-01` | **Limb 3 ✅ (driven):** real upload → full-screen "**Analyzing Your Photos…**" overlay + hint "If this takes too long, continue manually now…" + `ai-continue-manual-button` "**Continue Without AI**"; failure → "**Photo analysis issue**" / "Photo analysis is temporarily unavailable. Please try again later or fill in the details manually." + `ai-retry-button` "**Try Again**" (retry re-triggered the analysis, overlay re-appeared). **Limbs 1+2 ⏸ BLOCKED (environment, report F2):** Apply All / per-field Use need a successful suggestion set; the staging AI EF returns a **structured downstream 401** (`Invalid or expired bearer token`) — proven by a direct EF probe, HTTP 200 with per-item error. Not an app defect (graceful degradation is correct); unverifiable here, and never observed on any platform since 43g (2026-09-08) |

## Doc-drift found (not a defect)

- **J02 limb 3 wording:** the guide implies "Continue Without AI" appears *after ~7 s*. On-device it is present **immediately** (it lives inside `visible={isAnalyzingBlocking}`); `AI_ANALYSIS_BLOCKING_TIMEOUT_MS = 7000` is when the overlay **auto-releases**. Assertion intent still satisfied (the user is never truly blocked).

## Partial / source-traced items (explicit)

| Item | Disposition | Reason |
|---|---|---|
| J12 limb 2 — 10-photo cap alert | 🟡 PARTIAL | Would need ~3 more picker round-trips; count increments + cap copy driven; alert branch source-verified; J01 covers the cap text on-device (R2) |
| J12 F1 — publish-path validation bypass | 🔍 source-traced | Deliberately not driven (publishing would create a junk pending listing in shared staging) |
| J02 limbs 1–2 (Apply All / per-field Use) | ⏸ BLOCKED (environment) | AI provider credential invalid on staging — direct EF probe, see report F2 |

## Roll-up

**3 PASS (J11, J13, J15) · 1 FAIL (J12) · 1 PARTIAL (J02) · 0 SKIPPED · 0 BLOCKED-round-level**
Money Verification Layers: **N/A** (no money/SP-ledger surface exercised; SP figures were preview-only estimates; `sp-strip` read 2263 SP before and after).

## Tracker impact

- **No status flips applied.** Notes added to the J02 / J12 rows; J11 / J13 / J15 rows gain this round's evidence. **Recommended to the owner:** J12 → 🟡 PARTIAL and J02 → 🟡 PARTIAL (with the environment caveat) — reported, not unilaterally flipped, per the execution-only boundary.
