# QA Task — AUTH Android Round 3: Groups J/K residual cases (J02, J11, J12, J13, J15)

**Date:** 2026-09-18 · **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Group J — Listing Creation)
**Device:** Android emulator `Medium_Phone_API_36.1` (sdk_gphone64_arm64, Android 16) — 1080×2400 px, dev-client build
**App:** `com.sameralzubaidi.p2pmarketplace` · **Metro:** `:8082` (dev server row `http://10.0.2.2:8082`)
**Repo HEAD:** `e715003e` (2026-09-18 09:21:39, docs/tracker-only) · last app-code commit `40c1280f` (08:30:30)
**Round type:** completion of R2's 5 named residuals (R2 re-verified 16 J/K cases; these 5 were explicitly not re-driven)
**Verdict roll-up:** **2 PASS / 1 FAIL / 1 PARTIAL / 1 PARTIAL(env-blocked limbs)** — J11 ✅ · J13 ✅ · J12 ❌ · J15 ✅ (incl. the owed re-type sub-leg) · J02 🟡 (1 of 3 limbs PASS, 2 environment-blocked)

---

## 0. STEP 0 — RECONCILIATION (scope confirmed against the live tracker)

Live tracker = `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`. Round 2's report (`qa-auth-android-jk-r2-2026-09-18`) records **16 PASS / 0 FAIL / 0 BLOCKED / 5 NOT RE-DRIVEN**, and names exactly the 5 cases this round targets:

| This round's case | R2 disposition | Why it was owed |
|---|---|---|
| AUTH-TC-J02 | not re-driven | needs the AI-analysis wait + a 2nd item for per-field "Use" |
| AUTH-TC-J11 | not re-driven | needs a partial draft + Dashboard resume-banner round-trip (R2 §5 also left F4's fresh-mount control un-run) |
| AUTH-TC-J12 | not re-driven | 10 MB / MIME / 400 px gates "not AX-drivable on this build" |
| AUTH-TC-J13 | not re-driven | needs real Android system Photo Picker round-trips |
| AUTH-TC-J15 explicit price re-type | not driven | R2 demonstrated price-dependence by construction (26=20×1.30) but never re-typed the price |

**R2's F4 control (fresh-mount form-clearing) was NOT re-run** — the brief confirms FIX-Task-58 resolved it as expected R96 behavior (no bug, no retest needed). ✅ Consistent.
**No case in this batch has become covered elsewhere** — tracker rows for J02/J11/J12/J13/J15 still point at the 2026-08-24 / 2026-09-08 runs.

**Toolkit discovery that made J12 drivable (not in the brief):** the ItemCreate screen carries a **second dev fixture** the R2 report did not use — `dev-add-test-photo-uploaded` ("Dev: Add Uploaded Photo (AI/Draft)"), which injects a bundled photo *and* records a mock uploaded URL so the AI/draft code paths execute. Neither R2 nor the earlier 43g round used it; J02/J11's code paths are gated on `uploadedPhotoUrls`, which `dev-add-test-photo` deliberately does NOT set. This round used **real** uploads instead (see §2), so the fixture was available but not needed.

---

## 1. ENVIRONMENT + FRESHNESS GATE (§5.41 R29 busy check first)

| Check | Result |
|---|---|
| R29 / R77 #16 busy check | ✅ single `expo start` (pid 94592, port **8082**), `emulator-5554` online, no other agent drive in progress |
| **R79-1c freshness gate** | Metro started **06:27:52**; last app-code commit `40c1280f` **08:30:30** ⇒ **server PREDATES the commit ⇒ cold reload MANDATORY** |
| Cold reload performed | ✅ terminate → launch → dev-launcher → tapped `http://10.0.2.2:8082` → fresh bundle → clean "Pass It Up" Landing (**no LogBox**) |
| Bundle compile observation | First request after `--clear` took **>5 s** (curl 5 s timeout hit) and **10.6 s / 28.2 MB** on retry — the app's blank-frame window was a **bundler compile, not a stall** (verified host-side via `/status` = `packager-status:running`). **§5.9's "don't conclude a stall from repeated identical frames" held.** |
| R77 #2 IME hygiene | Gboard numeric keypad appeared on the price field; handled per §5.19 Rule 1 (screenshot **proving** the IME → single BACK → confirm gone) |
| Gallery seeding (R98) | `bash scripts/qa/android-seed-media.sh` → **6/6** committed `assets/qa-media` 720×720 PNGs registered (**1 → 7** MediaStore rows) |
| Rejection fixtures (**new this round**) | Generated two J12 fixtures with ImageMagick and registered them via the same approved script (`--source`): `qa-photo-07-oversize.png` = **2500×2500 noise, 37,531,423 B (37.5 MB > 10 MB cap, and ≥400 px so ONLY the size gate can trip)**, `qa-photo-08-unsupported.gif` = **720×720 GIF 31,130 B (≥400 px, so ONLY the MIME gate can trip)**. MediaStore 7 → 9 |
| Picker fresh-mount | The seed script force-stopped the app after registration ⇒ the first picker entry was a fresh mount (R98 step 4 honored — **the grid was empty for ~1 poll then populated**; no stale-list failure) |
| iOS simulator | iPhone 17 Pro Max online but **NOT driven** — Android-scoped round (R80 disclosure) |

**Read-only DB precondition check (Phase 23) — this step predicted the round's baseline exactly:** `test-seller` (id `14be337c-aad6-403f-bab2-ba1a7d80b666`) has `phone_verified_at` set (2026-08-21, so the J10 phone gate cannot interfere), node Norwalk Central, 307 items, and **5 `item_drafts` rows — ALL expired** (`expires_at` ≤ 2026-09-15). `getActiveDrafts()` filters `expires_at > now()`, so the Dashboard resume-banner baseline was a **clean zero** — making any banner attributable to this round's draft. Confirmed on-device before any write (**no banner**).

---

## 2. PER-CASE VERDICTS (Android, HEAD `e715003e`, fresh bundle)

| TC-ID | Verdict | Key on-device evidence |
|---|---|---|
| **AUTH-TC-J12** | ❌ **FAIL** | **Limb 1 (multi-upload) ✅:** real Android system Photo Picker, 3 valid 720×720 PNGs selected in ONE multi-select action → strip shows **"(3/10 photos)"**, 3 distinct thumbnails, "Cover" badge on the first, remove/reorder/replace controls on each, form unlocked, "Submit for Review" footer appeared. **Upload verified at the storage layer:** 3 objects at `14:45:51–52Z` (`photo_0` 42,911 B / `photo_1` 14,465 B / `photo_2` 8,974 B — distinct sizes = distinct images). **Limbs 3+4 (type/size rejection) ❌ FAIL — see §4 F1:** selecting the 37.5 MB PNG and the GIF (both rendered as selectable tiles, the GIF carrying a "GIF" badge) took the count to **"(4/10 photos)"** with two new slots + full per-photo controls, and **NO error of any kind was shown**. **Limb 2 (10-photo cap) 🟡 PARTIAL** — not taken to 10 this round; the cap copy renders ("Add up to 10 photos", "(N/10 photos)") and `selectionLimit = max(0, 10 - photos.length)` + the `Alert.alert('Limit reached','You can add up to 10 photos.')` branch are source-verified. |
| **AUTH-TC-J13** | ✅ **PASS** | All four limbs driven on the real picker. **Remove:** "Remove photo 2" → count updated **immediately** to "(2/10)", the tapped photo id (`…-1`) gone. **Reorder:** "Move this photo earlier" on the 2nd photo → slot 0 now holds `…-2` and carries the **Cover** badge (lead photo changed). **Replace:** "Replace this photo" (⟳) on slot 1 → slot **kept**, its photo id changed to a NEW object, and a **real new upload** landed (`photo_0_1789742981692.jpg`, 5,564 B, 14:49:51Z) — visible in-slot as the new purple/magenta image. **Persist after resume:** left the screen (draft auto-saved), then `resume-draft-banner` → Continue → ItemCreate showed **"(2/10 photos)"** with Cover at slot 0 (`restored-photo-0`) and title **"QA Dev Fixture Item"** restored. **DB closure:** `item_drafts.155a5c44…` `photo_urls` = `[…/1789742746143/photo_2…jpg` (the reordered cover), `…/1789742981692/photo_0…jpg` (the replacement)] — the removed checker is **absent** and the order is preserved. |
| **AUTH-TC-J11** | ✅ **PASS** | **Limb 1:** after adding a photo + partial details and leaving the screen, the Dashboard rendered `resume-draft-banner` with title **"You have 1 unfinished listing"** + subtitle "Continue where you left off" + `resume-draft-banner-resume-button` "Continue" / "Maybe later". Count = 1 against a **verified 0 baseline** ⇒ attributable and DB-corroborated. **Limb 2:** Continue → the draft reopened with photos **and** title restored (see J13). 7-day TTL confirmed in the row: `expires_at = 2026-09-25` (created 2026-09-18). |
| **AUTH-TC-J15** | ✅ **PASS** (incl. the owed **explicit price re-type** sub-leg) | Driven live through the real `CategorySelectModal` (AX-drivable on Android): **Games (standard) @ $20** → "You'll earn **~22 SP**" + "**1.10x multiplier for this category**" + buyer-cap "**~14 SP** toward this $20 price" (20×1.10=22 ✓, 20×0.70=14 ✓). **Explicit re-type:** CTRL+A + typed `30` in the price field (value verified "30") → preview recalculated to **~33 SP** + "1.10x" + "buyers can pay up to **~21 SP** toward this **$30** price" (30×1.10=33 ✓, 30×0.70=21 ✓ — and the cap line's own price text updated). **Bonus leg:** switch to **Books** → "You'll earn **~39 SP**" + "**1.30x multiplier for this category**" (30×1.30=39 ✓) — a real uplift vs 33 at the same $30. **Switch-back leg:** return to **Games** → preview recalculated to **~33 SP / 1.10x** — uplift removed. Bonus ⭐ badges render on **Books / Toys / Electronics / Art & Crafts** only, matching R2. Both seller-earn **and** buyer-cap previews render together, plus the disclaimer "*Estimated based on list price. Actual SP may vary." |
| **AUTH-TC-J02** | 🟡 **PARTIAL** (2 of 3 limbs environment-blocked — see §4 F2) | **Limb 3 ✅ PASS (driven):** after the real photo upload the full-screen overlay rendered "**Analyzing Your Photos…**" + "Our AI is reviewing your photos to suggest item details." + the hint "If this takes too long, continue manually now and we will show suggestions when ready." with `ai-continue-manual-button` "**Continue Without AI**"; on failure the error card rendered "**Photo analysis issue**" / "Photo analysis is temporarily unavailable. Please try again later or fill in the details manually." + `ai-retry-button` "**Try Again**" (retry re-triggered the analysis — the overlay re-appeared). **Limb 1 (Apply All) + Limb 2 (per-field Use) ⏸ BLOCKED (environment):** both require a *successful* suggestion set, which this environment cannot produce (root-caused in §4 F2). No success card has ever been observed on any platform (43g, 2026-09-08, recorded the same). |

### Doc-drift found while driving J02's limb 3 (report as drift, not a defect)
The guide says *"After ~7 seconds a **Continue Without AI** option lets the seller proceed manually"*. On-device the button is **present immediately** — it lives inside the blocking overlay (`visible={isAnalyzingBlocking}`), which is exactly `isAnalyzing && !allowManualWhileAnalyzing`; the **7 s** constant (`AI_ANALYSIS_BLOCKING_TIMEOUT_MS = 7000`) is when the overlay **auto-releases** (proceed manually without tapping), not when the button appears. The assertion's intent is satisfied (the user is never truly blocked), but the wording is imprecise.

---

## 3. DESIGN-SYSTEM + COPY COMPLIANCE

**Design-system result: ✅ PASS — no deviations on any surface driven.**

| Surface | Verdict |
|---|---|
| **ItemCreate ("New Item")** | CONFIRMED — canonical detail header (`back-button` 105 px round gray + caret-left, centred 700-weight title, bell + chat with badges); photo-first gating intact; "Cover" badge; pill-shaped slot controls (✕ / ◀ ▶ / ⟳); sticky footer; filled inputs. |
| **"Add Photos" source sheet** | CONFIRMED — single primary/secondary pairing (Take Photo / Photo Library) + outline Cancel; AX-exposed (`item-photo-source-*`). |
| **CategorySelectModal** | CONFIRMED — full-screen sheet, "Select Category" + `close-modal`, filled search, emoji rows + ⭐ bonus badges on exactly Books/Toys/Electronics/Art & Crafts. |
| **AI overlay + AI error card** | CONFIRMED — single primary action per state ("Continue Without AI" / "Try Again"); the error card renders as a low-emphasis card, not a red error banner. |
| **Dashboard resume banner** | CONFIRMED — canonical green `#5DBB8E` left rail + icon tile, title/subtitle hierarchy, "Continue" primary + "Maybe later" text secondary. |
| **SP preview block** | CONFIRMED — SP-gold "✓" estimate row, `sp-info-icon`, `buyer-cap-line` with the coins icon, low-emphasis disclaimer. |
| **Off-brand hex sweep — R62b (3-hex)** | Hits only in **`SellerEarningsScreen.tsx`** (`#808080`/`#4D4D4D`) — **not a surface driven this round** (pre-existing, no AUTH J/K exposure) — and in `ContinueKidsClubScreen.tsx:32` as a **comment** documenting the removal. |
| **Off-brand hex sweep — R62d (full list)** | All system-blue-family hits triaged for **liveness**: `.old` screens (Login/Signup), **unrouted** `LoginScreen.tsx`/`SignupScreen.tsx`, comment-only (`MyListingsScreen`, `AutoRenewToggle`), a test's own `OFF_BRAND_BLUES` constant, `atoms/Button` (no importer). Genuinely-live leftovers are **`PriceSuggestionCard.tsx`** (`#007AFF`/`#0066CC`), **`CategoryFilterChip.tsx`** (`#007AFF`), `ColorPicker`'s blue swatch (`#2196F3`), `BadgeCelebrationModal` confetti, `usePaymentSheet` appearance — **none of which render on the surfaces driven this round**. |
| **On-screenshot color scan (R62e)** | Full-frame `qa:badge-scan` (0,0,1080,2400) for the system-blue family on the 3 most representative frames: **ItemCreate 0.00%/0.00%**, **AI overlay 0.00%/0.00%**, **SP-preview screen 0.00%/0.00%**, Dashboard banner **119 px = 0.005%** (AA/compression noise; real fills are ≥0.1% per R62c#2). **No off-brand fill present.** |

**Copy / machine-system-content audit (§6.3 / R58): PASS.** Every user-facing string on the driven surfaces is human-readable; **no raw backend code, UUID, or `snake_case` token** was surfaced. Notably the AI failure is user-friendly ("Photo analysis is temporarily unavailable…") even though the underlying error is a downstream provider 401; and the resume banner reads "You have 1 unfinished listing" (correct singular).

**Popup/modal design-system compliance (§6.4):** the Add-Photos sheet, CategorySelectModal, AI overlay and the banner all use canonical component patterns (single primary + secondary outline + text tertiary; no competing primaries).

---

## 4. FINDINGS (correctness / data-integrity)

### F1 · HIGH (new) — J12's type/size validation is not enforced on the listing surface: invalid files are added to the listing silently, and the publish path re-uploads strip photos with **no** validation
**Driven on-device.** With the 10 MB cap and the MIME allow-list both publicly asserted by AUTH-TC-J12, selecting a **37.5 MB PNG** and a **GIF** produced:
1. **no rejection UI of any kind** — no Alert, no toast, no inline error, no banner (AX tree immediately after the picker closed showed only normal form elements; no dialog);
2. the count advanced to **"(4/10 photos)"** with two new slots and full per-photo controls — i.e. the unsupported file **was added to the listing**, directly contradicting J12's "is not added to the listing"; and
3. **no upload** — `photoService.validatePhoto()` runs *before* compression inside `uploadPhotoBatch` (line ~156), pushed the two failures into `result.errors`, and the storage bucket gained **zero** new objects (verified by read-back: the newest object is still the 14:49:51 replacement).

**The reason there is no UI:** `ItemCreateScreen.uploadPhotos()` handles `result.errors` with `captureException(...)` **only** — there is no user-facing branch. So the rejection exists at the data layer but is invisible at the UI layer.
**Second limb (source-traced, NOT driven — flagged as such):** at publish, `handlePublish` passes **`photos.map(p => p.uri)`** — every strip photo including the invalid ones — to `uploadListingImages()`, which validates **neither size nor MIME** (only a `> 10` count guard). The draft path is safe (`combinedPhotoUrls` filters out photos with no URL), but the publish path is not, so the same validation gap is bypassed at submit. **I did not publish to prove this** (it would create a junk pending listing in shared staging) — labelled source-traced per R13.
**Impact:** a seller can build a listing whose UI shows photos that will never exist, with no error; and the documented 10 MB/MIME contract is unenforced on the publish path.
**Scope note (owner constraint honored):** reported as a **correctness/data-integrity** gap. I am **not** proposing UX or layout changes — the copy/error-presentation wording decision is deliberately left to the owner.

### F2 · MEDIUM (root-caused, environment) — the staging AI analysis provider credential is invalid, so J02's success limbs are unreachable
Established with a **direct Edge Function probe** (read-only, publishable key, no app involved):

```
POST /functions/v1/batch-analyze-items   → HTTP 200
{"results":[{"groupId":"qa-probe","error":"Analysis failed: 401
  {\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Invalid or expired bearer token\"}}"}],
 "totalProcessed":1,"totalFailed":1}
```

Both AI functions (`batch-analyze-items`, `analyze-item-image`) **are deployed**; the failure is **downstream** — the EF forwards a bearer token to its AI provider and receives 401 `Invalid or expired bearer token`. The app's graceful degradation is correct (friendly "Photo analysis issue / temporarily unavailable" + **Try Again** + **Continue Without AI**), so this is **not an app defect** — but it makes **J02's Apply All and per-field "Use" limbs unverifiable in this environment**, and has done so since at least 43g (2026-09-08). **Owner/dev action:** refresh the AI provider credential on staging.
**Corroborating negative (recorded, not over-read):** the project's `function_edge_logs` window contained **no** `/functions/v1/batch-analyze-items` entry for the app's own analysis attempts — **but my own probe was also absent from the same source**, so this is log **ingestion lag**, not proof the app never called. The probe result above is the decisive evidence.

### F3 · INFO — four off-brand-hex hits are dead code, one family is live but off-path
See §3. `PriceSuggestionCard.tsx`, `CategoryFilterChip.tsx`, `ColorPicker`'s blue swatch, `BadgeCelebrationModal` confetti and `usePaymentSheet`'s appearance still carry `#007AFF`/`#0066CC`/`#2196F3`. **Liveness-triaged this round (R62d)** — none renders on the J/K surfaces driven. Recorded for the standing sweep; no action taken (execution-only).

### F4 · LOW (friction) — the Android photo picker grid is AX-exposed, but screenshot-estimated coordinates miss by ~1 row
My first picker tap was derived from the **downscaled screenshot** and landed **8 px inside the wrong row** (selecting the GIF instead of the ring photo). The picker's grid **is** AX-exposed with `taken on <date>` labels, and every subsequent tap derived from the tree landed exactly. Reinforces §5.1 (fresh tree before every tap) and R104 over screenshot estimates — and is worth noting because the picker *looks* un-instrumentable.

---

## 5. PERCEIVED LOAD-TIME TABLE

*Perceived load time (Android emulator, wall-clock, ±polling-interval precision) — **not a formal performance profile**.*

| Screen → transition | Elapsed | Flagged? |
|---|---|---|
| Dev-launcher row tap → bundle served → Landing | **> 5 s first attempt; 10.6 s** for the 28.2 MB bundle | **Flagged ≥3 s — dev-build cold bundle transform after `--clear`, NOT app behaviour** (host-verified: Metro was `running` and simply compiling) |
| `qa-login-as` deep link → Dashboard painted (2nd fire; 1st dropped per R111) | ~3–4 s | borderline; spinner shown throughout (adequate feedback) |
| Dashboard → ItemCreate (deep link) | < 3 s | no |
| Photo Picker first mount → grid populated | ~1 poll (~1–2 s) | no |
| Picker "Done" → 3 photos in strip | < 1 s | no |
| Photo strip → AI analyzing overlay | < 1 s after the real uploads landed | no |
| AI analyzing → result (error card) | **~30 s** (analysis + EF round-trip) | **Flagged ≥3 s — correctly handled:** full-screen overlay with spinner + explanation + an escape hatch ("Continue Without AI"); auto-releases at 7 s |
| Remove / reorder / replace taps | all < 1 s | no |
| Leave ItemCreate → Dashboard banner visible | < 1 s | no |
| Resume banner → draft restored | < 3 s | no |
| Category switch → SP preview recalculated | < 1 s | no |

---

## 6. KNOWN GAPS / NOT TESTED (explicit reasons)

- **J02 limbs 1–2 (Apply All, per-field Use):** ⏸ BLOCKED (environment) — no successful AI suggestion set is producible on staging (F2). Not source-only hand-waving: the EF was probed directly.
- **J12 limb 2 (10-photo cap / the 11th-photo message):** 🟡 PARTIAL — drove the count upward (0→3, 3→2, 2→4) and confirmed the cap copy renders, but did not spend the ~3 extra picker round-trips needed to reach 10 and trigger `Alert('Limit reached','You can add up to 10 photos.')`. Code path source-verified; **J01 (Android, R2) already PASSes the 10-photo cap text on-device.**
- **J12 F1's publish-path limb:** **source-traced only** — deliberately not driven (would create a junk pending listing in shared staging). Labelled per R13.
- **AI success-branch rendering** (`ai-analysis-card`, `apply-all-button`, `use-<field>`): **not rendered, not asserted** this round — unreachable (F2).
- **`dev-add-test-photo-uploaded` fixture path** (mock URL): available and documented, but deliberately **not used** — real uploads were driven instead so J12/J13's evidence is genuine-storage evidence.
- **iOS:** the iPhone 17 Pro Max simulator was online but **not driven** (Android-scoped round). **Per R80 this Android result is not an iOS closure claim.**
- **AUTH residual rows (unchanged, out of scope):** `S01` (staging SMTP — owner), `C03` (Apple provider not enabled in staging GoTrue), `S03`, `S05` (deliberate SKIPs).

---

## 7. MONEY VERIFICATION LAYERS

**N/A — confirmed explicitly (as Round 2 did).** No case in this batch touched money: no charge, refund, void, hold, payout, saved payment method, fee or SP *ledger* movement was exercised. The only SP figures seen were **preview-only estimates** (J15's `sp-earnings-preview`, computed client-side from list price × category multiplier) — no SP was earned, reserved, spent, or written to `sp_wallets`/`sp_transactions`. `sp-strip` on the Dashboard read **2263 SP** before and after the round (unchanged). Therefore no UI/DB/Provider (Stripe) three-layer reconciliation applies.

---

## 8. EVIDENCE INDEX (`screenshots/`)

| File | Shows |
|---|---|
| `JK3-01-coldreload-landing.png` | fresh bundle after the mandatory cold reload ("Pass It Up" Landing, no LogBox) |
| `J12-01-three-valid-photos.png` | **3 valid photos from ONE multi-select** → "(3/10 photos)", Cover badge, per-photo ✕/◀▶/⟳, form unlocked, footer |
| `J13-01-after-remove.png` | after removing photo 2 (count → 2/10) |
| `J13-02-after-reorder.png` | after "move earlier" (lead photo + Cover badge changed) |
| `J13-03-after-replace.png` | after replace (slot kept, new image in-slot) |
| `J11-01-dashboard-resume-banner.png` | Dashboard `resume-draft-banner` — "You have 1 unfinished listing" + Continue |
| `J11-02-draft-resumed.png` | draft reopened from the banner (photos restored, Cover at slot 0) |
| `J11-03-restored-title.png` | restored title "QA Dev Fixture Item" in the resumed draft |
| `J12-02-after-invalid-picks.png` | **F1 core evidence** — "(4/10 photos)" after adding the 37.5 MB PNG + the GIF, **no error UI anywhere** |
| `J02-01-ai-analyzing-overlay.png` | AI analyzing overlay + "Continue Without AI" + the 7 s auto-release hint |
| `J15-01-games-20.png` | Games @ $20 → ~22 SP / 1.10x / cap ~14 SP |
| `J15-02-games-30.png` | **explicit re-type** → ~33 SP / 1.10x / cap ~21 SP toward $30 |
| `J15-03-books-bonus-30.png` | Books (bonus) @ $30 → ~39 SP / **1.30x** / cap ~21 SP (+ disclaimer) |
| `J15-04-back-to-games-30.png` | switched back → ~33 SP / 1.10x (uplift removed) |
| `FINAL-01-logged-out-landing.png` | clean logged-out Landing left behind |

**Capture obligation (§5.6):** a frame exists for **every** transition named in §2/§5 except the AI **error card** on its own (it is visible inside `J02-01`'s follow-up tree reads but the standalone frame was not persisted at that moment) — named here rather than silently traded.

---

## 9. APP STATE LEFT BEHIND (persona mutations + re-run requirements)

| Item | State |
|---|---|
| **`test-seller` draft (NEW)** | `item_drafts.155a5c44-c813-41b3-bcb2-701e82f13f0f` — title "QA Dev Fixture Item", price **30**, `step='review'`, **2** `photo_urls`, created 14:45:53Z, expires **2026-09-25**. This is what makes the Dashboard resume banner show. **Re-run note: delete this row (or let it expire) to restore the banner baseline to zero.** |
| **Storage objects (NEW, 4)** | `item-images/drafts/14be337c-…/1789742746143/photo_0·1·2` (42,911 / 14,465 / 8,974 B) + `…/1789742981692/photo_0` (5,564 B). One further object (`1788870147866`, 2026-09-08) predates this round. **Cleanup candidate.** |
| **Items created** | **NONE** — no listing was published this round (deliberately; see F1's scope note). `test-seller` item count unchanged (307). |
| **Emulator gallery (MUTATED)** | MediaStore now indexes **9** images in `/sdcard/DCIM/Camera` + `/storage/emulated/0`: the 6 committed `assets/qa-media` fixtures, a pre-existing `qa-shot.png`, and **2 generated J12 fixtures** (`qa-photo-07-oversize.png` 37.5 MB, `qa-photo-08-unsupported.gif`). **Host copies live at `/tmp/qa-j12-fixtures/` (regenerate with the two ImageMagick commands if wiped).** No `seed:staging` run was needed this round. |
| **`seed:staging` needed for a re-run?** | **No, for phone/TOS state** — `test-seller.phone_verified_at` was already set and no verification flow was triggered. **Yes, if a clean resume-banner baseline is required** (delete the draft above), and **the 2 rejection fixtures must be re-pushed** if the emulator is wiped (`bash scripts/qa/android-seed-media.sh --source /tmp/qa-j12-fixtures`). |
| **Shared staging config** | **UNTOUCHED** — no `admin_config` write, no RPC write, no migration. The SP multipliers read (Games 1.10, Books 1.30) are the live baseline. |
| **App/session state** | Logged out via `p2pkidsmarketplace://qa-logout` → clean Landing left on screen (FINAL-01). |
| **Money/SP state** | Unchanged (see §7) — no SP moved, `sp-strip` still 2263 SP. |

---

## 10. FRICTION LOG (playbook / instrumentation)

1. **R79-1c fired for real:** Metro up 06:27:52 vs the 08:30:30 commit ⇒ a cold reload was **mandatory**, and it was the difference between testing the current build and a 2-hour-old one.
2. **Repeated identical blank frames were NOT a stall (§5.9 addendum, re-confirmed live):** three identical white frames during bundling; the host-side `/status` probe (`packager-status:running`) plus the 10.6 s/28.2 MB bundle fetch proved the bundler was simply compiling. **Do not relaunch on repeated identical frames** — probe the host first.
3. **R111 reproduced once:** the first `qa-login-as` deep link was silently dropped (app still initialising after the cold reload); one clean re-fire logged in.
4. **R104 re-confirmed with a real miss:** a screenshot-derived picker coordinate landed **8 px inside the wrong row** (selected the GIF). The picker grid **is** AX-exposed (`taken on <date>` labels) — derive from the tree, never the downscaled image.
5. **`function_edge_logs` ingestion lag:** neither the app's AI attempts nor my own synthetic probe appeared in the queried window. Treat near-real-time edge-log reads as unreliable **within the first minutes**; use a direct EF probe for a decisive answer.
6. **The mobile toolset exposes no `mobile_list_available_devices`** on this build; the device id is the friendly name `Medium_Phone_API_36.1` (not the adb serial) — `emulator-5554` is rejected.
7. **Implicit `ScrollView` position resets:** tapping a dev-fixture button scrolled the form back to the top (the fix-task-58 "re-list AFTER each dev-fixture tap" gotcha re-confirmed). Long ItemCreate traversals still need 2–3 anchored `adb shell input swipe` steps, and **overshoot is easy** (I overshot the category section twice) — budget one extra swipe+list pair per traversal.
8. **The ItemCreate dev-fixture stack is the cheap path** for any price/category leg: `dev-price-input` + `dev-set-price` and `dev-set-category` avoid the IME entirely. **Caveat: `dev-set-category` selects the FIRST non-Other category = Books (a bonus category)** — it cannot be used to pick a *standard* category, so a J15 standard-vs-bonus comparison must use the real modal (which *is* AX-drivable).

---

## 11. RECOMMENDED FOLLOW-UPS (flagged, NOT applied — execution-only)

1. **DEV (from F1, correctness):** surface a user-facing rejection for `uploadPhotoBatch` errors on ItemCreate (the returned `errors[]` is currently only `captureException`'d), and decide whether invalid strip photos should be excluded from the strip / blocked from publish — then extend the size/MIME check to `uploadListingImages` so the publish path cannot bypass it. **Copy/UX wording for the message is the owner's call** (the planned ItemCreate redesign may absorb it — flagged, not specified).
2. **DEV/OPS (from F2, environment):** refresh the staging AI provider credential (the EF's downstream bearer token returns 401 `Invalid or expired bearer token`), otherwise **AUTH-TC-J02's Apply All / per-field Use limbs remain unverifiable on every platform** and the J02 tracker row keeps resting on 43g's failure-branch + source corroboration.
3. **QA (coverage):** drive J12's 10-photo-cap limb (2–3 picker round-trips) and, if a non-production tenant is available, the publish-path validation limb, to convert the two PARTIAL/source-traced items into driven verdicts.
4. **Tracker:** the J02 row's ✅ PASS should carry a caveat (success limbs never driven; environment-blocked), and J12's row needs the F1 finding attached — see the notes added this round.
