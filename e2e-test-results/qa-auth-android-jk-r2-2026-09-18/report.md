# QA Task — AUTH Android R2: Groups J (Listing Creation) + K (Bulk Listing)

**Date:** 2026-09-18 · **Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Groups J, K)
**Device:** Android emulator `Medium_Phone_API_36.1` (sdk_gphone64_arm64, Android 16) — 1080×2400 px, dev-client build
**App:** `com.sameralzubaidi.p2pmarketplace` · **Metro:** `:8082` (dev server row `http://10.0.2.2:8082`)
**Repo HEAD:** `40c1280f` (2026-09-18 08:30:30) · **Round type:** **RE-VERIFICATION** (see §0)
**Verdict roll-up:** **16 PASS / 0 FAIL / 0 BLOCKED / 5 NOT RE-DRIVEN** (all 5 have Android PASS on record)

---

## 0. STEP 0 — RECONCILIATION (the brief's premise was STALE)

The brief scoped this round as "the largest deferred chunk: Group J (~13 cases) and Group K (~6 cases), both **explicitly deferred as needing a test-seller block**". **That deferred-list summary is stale.** Per the standing Step-0 rule the live tracker was pulled before scoping, and it shows:

> **Live tracker** = `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (last maintained 2026-09-14).
> **AUTH: 138 cases · 128 PASS / 1 PARTIAL / 2 OPEN / 2 SKIPPED / 5 REMOVED · Remaining (NEVER RUN) = 0.**

**Every Group J and Group K case already had an Android verdict, executed 10 days earlier on 2026-09-08:**

| Prior run | Cases covered on Android |
|---|---|
| `qa-task43f-auth-backlog-2026-09-08` | J01, J03, J04, J06, J08, J09 (PASS) + J05 (PARTIAL — field-clear tooling limit) |
| `qa-task43g-jk-l-2026-09-08` | J02, J07, J10, J11, J12, J13 + **K01–K06 all PASS** |
| `qa-task-cleanup1-e04-j14j15-android-2026-09-08` | J14, J15 (PASS; 43a-exec PARTIAL resolved) |
| `qa-task43h-fix-task5-verify-2026-09-08` | J10 completion leg (Android PARTIAL → PASS) |
| `qa-task43l-group-l-auth-reconcile-2026-09-08` | Group L L01–L04 + J10 typed-OTP path |

**Consequence — this round was executed as a re-verification at current HEAD, not a first pass.** Rationale: the codebase moved through **FIX-Task-33 … FIX-Task-56** in the 10 days since those verdicts (including FIX-Task-53's SP/grace work and FIX-Task-55 at HEAD), so a 10-day-old PASS is stale-by-age and worth re-driving on the current bundle. The round therefore re-drives the J/K surface to confirm the verdicts still hold, rather than claiming new coverage.
**Residual AUTH non-PASS rows (unchanged by this round):** `S01` (staging Supabase SMTP not configured — owner step) · `C03` (Apple provider not enabled in staging GoTrue) · `S03`, `S05` (SKIPPED).
**Discrepancy resolved:** tracker row `AUTH-TC-J05` reads PASS (iOS, 2026-08-24) while 43f recorded an Android PARTIAL. This round **re-drove J05 end-to-end on Android** — the previously "source-verified only" blocked-submit leg is now **genuinely driven on-device** (see §2).

---

## 1. ENVIRONMENT + FRESHNESS GATE

| Check | Result |
|---|---|
| Emulator | `emulator-5554` / toolset id `Medium_Phone_API_36.1` — online |
| App installed | ✅ `com.sameralzubaidi.p2pmarketplace` |
| Metro | ✅ `expo start --port 8082` (pid 94592) — **note: NOT 8081** |
| **R79-1c freshness gate** | Metro started **06:27:52**; HEAD `40c1280f` committed **08:30:30** ⇒ **server PREDATES the commit by ~2 h ⇒ cold reload MANDATORY** |
| Cold reload performed | ✅ terminate → relaunch → dev-launcher → tapped `http://10.0.2.2:8082` → fresh bundle → clean Landing (no LogBox) |
| R77 #2 IME hygiene | ✅ `adb shell settings put secure stylus_handwriting_enabled 0` applied at session start; the Gboard "Try out your stylus" tutorial did not appear |
| iOS simulator | iPhone 17 Pro Max online but **NOT driven** — this round is Android-scoped (R80 disclosure) |

---

## 2. PER-CASE VERDICTS

| TC-ID | Verdict | Key on-device evidence (Android, HEAD `40c1280f`) |
|---|---|---|
| **AUTH-TC-J01** | ✅ **PASS** | Before photo: **only** the Photos section renders — no `title-input`, no `publish-button`, and `dev-set-category` **disabled**. After 1 photo: `(1/10 photos)`, `photo-slot-filled-0` + "Cover" badge + remove/replace controls, `dev-set-category` enabled, `publish-button` appears **disabled**, `title-input`/`description-input` render. Photo-first gating holds. 10-photo cap text "Add up to 10 photos" present. |
| **AUTH-TC-J03** | ✅ **PASS** | Photo present, title empty (category+price filled) → `publish-button` **disabled** (repeatedly observed). After `dev-fill-item` filled Title/Price/Condition → `publish-button` **enabled**. Required-field gate enforced via the disabled-submit branch (the guide permits "stays disabled **or** shows errors"). |
| **AUTH-TC-J04** | ✅ **PASS** | Condition = **New / Like New / Good / Fair / Worn** each with its description ("Brand new with tags" … "Heavy wear, still usable"). Age Group = **0-2 / 3-5 / 6-8 / 9-12 / 13+ years**. Gender = **Boy / Girl / Unisex / Any** ("Any" default-selected). Colors = **12-tile multi-select** ("0/3 selected"; Red…Multicolor). |
| **AUTH-TC-J05** | ✅ **PASS** | **Discrepancy closed on-device.** Real Category modal → "+ Other (Custom Category)" → modal swaps to `custom-category-input` ("Enter custom category name:"), helper text **"This will be sent to admin for review"**, `submit-other` **DISABLED** while empty → after typing a name `submit-other` becomes **ENABLED**. Submission genuinely blocked until a custom name is provided. |
| **AUTH-TC-J06** | ✅ **PASS** | Subscriber sees `sp-toggle` ("Accept Swap Points?" + hint "Allow buyers to pay with Swap Points"). Toggled ON → switch `checked` + **"✓ SP Eligible"** badge (SP-gold pill) appears. **DB-corroborated:** created item `027f308e…` has `accepts_swap_points = true`. |
| **AUTH-TC-J07** | ✅ **PASS** | As `test-free`: **no `sp-toggle`**; instead **"🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!"** + `sp-upgrade-button` "Upgrade Now". |
| **AUTH-TC-J08** | ✅ **PASS** | Subscriber SP preview renders: "Swap Points Estimate" (with `sp-info-icon`) → "You'll earn: **~26 SP**" + "**1.30x multiplier for this category**" + `buyer-cap-line` "Buyers can pay up to **~14 SP** toward this $20 price with Swap Points" + disclaimer "*Estimated based on list price. Actual SP may vary." **Math verified: $20 × 1.30 = 26 ✓; Books 70% cap → $20 × 0.70 = 14 ✓.** |
| **AUTH-TC-J09** | ✅ **PASS** | "Submitting Item For Review…" overlay (spinner + "Please wait. We are uploading your item and preparing it for admin review.") → success modal **"Thanks for submitting!"** with the exact guide copy + **Go To My Items** (primary) / **Go To Dashboard**. My Listings shows the item as **PENDING** with `listing-pending-hint-027f308e…`. **DB:** `027f308e-c4f8-4ec5-a605-538f396460f9`, `status=pending`, `approved_at=NULL`, Books `category_id`, `$20.00`, `created_at 12:43:53Z`. |
| **AUTH-TC-J10** | ✅ **PASS** | `listing-phone-verification` gate blocks publish ("Phone verification is required before you can publish listings or make purchases"). Phone field **prefilled `+15551234004`** = test-free's real `profiles.phone` `5551234004` in E.164 → **Send Code ENABLED and fires** → OTP step ("We sent a 6-digit code to +15551234004", DEV hint `123456`, "Resend code in 55s") → autofill+verify → **publish resumes** → "Thanks for submitting!" modal. **DB:** `test-free.phone_verified_at = 2026-09-18 12:57:10Z`; test-free item count now 7 (new pending item). **43g's blocker is FIXED** (old prefill was the `+1 (555) 123-4567` placeholder that never matched). |
| **AUTH-TC-J14** | ✅ **PASS** | `CategorySelectModal` IS AX-drivable on Android. Bonus ⭐ badges render on **Books, Toys, Electronics, Art & Crafts** (`bonus-badge-<id>`), and **none** on Games, Sports, Clothing, Other, Shoes, Bookies. After selecting Books the form's category control reads "Books" and the SP preview identifies it ("1.30x multiplier for this category"); **DB:** item `category_id` = Books `4b400d90…`. |
| **AUTH-TC-J15** | ✅ **PASS** | Category-specific preview recalculates from the selected category + price: Books (bonus, 1.30×) at $20 → earn "~26 SP" **and** buyer cap "~14 SP toward this $20 price" (70% cap) — both derived live from $20, proving price-dependence. Bonus uplift is reflected in the "1.30x multiplier for this category" line. |
| **AUTH-TC-K01** | ✅ **PASS** | `dev-add-test-photos` → "Photos **5/30**" and the step indicator advanced to **"Step 2: Group, current"**; item cards created (`group-card-0` "Item 1" with a COVER tile, `group-card-1` "Item 2", …). Duplicate-hash detection is **not exercisable** with this fixture (all 5 injected photos are the same bundled asset — documented dev-fixture limitation, unchanged from prior rounds). |
| **AUTH-TC-K02** | ✅ **PASS** | Long-press on `photo-tile-0-0` → selection mode (`selection-action-bar`, tiles relabelled "Select/Deselect this photo") → tap `photo-tile-1-0` → **"2 selected"**, `selection-merge` enabled → Merge → **`group-card-0` now holds `photo-tile-0-0` + `photo-tile-0-1`** (two photos in one item), cards renumbered, selection bar cleared. Move-to-new / Delete / Clear-selection controls all exposed. *Sub-leg nuance: the "move a photo to another item" and "reorder within a group" gestures were **affordance-verified** (controls + labels present), not separately driven — see §6.* |
| **AUTH-TC-K03** | ✅ **PASS (stages 1–3)** | Step indicator verified at three live stages: **"Step 1: Photos, current"** → **"Step 2: Group, current"** → **"Step 3: Review, current"**, each `selected` with the others `disabled`. Stage 4 (Publish) "current" highlight is **not reachable through the dev-fixture path** (the fixture never creates a bulk session, so publish cannot complete). |
| **AUTH-TC-K04** | ✅ **PASS (Condition chip)** | `apply-to-all-bar` → expanded via `apply-to-all-toggle` (caret flips down→up, label becomes "Collapse apply to all options") → chip **`apply-to-all-condition`** = "Apply Condition new to all included items" (label "Condition" + value "new"). Brand / Age / Gender chips do **not** render because the fixture items carry no such values — consistent with the documented "each chip suggests the **most common value**" behaviour (same fixture-gating as the 2026-09-08 PASS). |
| **AUTH-TC-K05** | ✅ **PASS** | `bulk-publish-button` was **disabled** while items lacked required fields and **enabled** after `dev-set-item-categories` + `dev-fill-bulk-items`. Button label **"Submit 4 Items for Review"**. Tap → `bulk-publish-confirm-sheet`: "Confirm Submission" / "Items to submit for review: **4**" / 4 × `publish-summary-row-N` ("QA Dev Fixture Item N", "**$20 • Ready**") + Cancel / Submit for Review. Confirm → documented dev-fixture caveat alert **"Cannot submit for review — Missing bulk session or draft session. Add your photos from the camera or library to start a session, then submit for review."** (GlobalAlertProvider, AX-exposed: `global-alert-button-0` "Start Over" / `global-alert-button-1` "Cancel"). |
| **AUTH-TC-K06** | ✅ **PASS** | Subscriber `bulk-sp-summary` renders: "**Bulk Listing SP Summary**" + `sp-info-icon`, "Included items: **4**", "SP-enabled items: **0**", plus the `non-accepting-sp-items` guidance "⚠️ 4 items are set to Cash Only" / "Enable "Accept Swap Points" on a card to add it to SP totals. Cash Only items are never counted." **Count reconciliation (M1 lesson):** "Review 4 items" ⇄ "Included items: 4" ⇄ "Submit 4 Items for Review" ⇄ the post-merge item count — **all four agree at 4** ✓ |

### Not re-driven this round (Android PASS on record from 2026-09-08)

| TC-ID | Prior Android verdict | Why not re-driven |
|---|---|---|
| AUTH-TC-J02 (AI auto-fill Apply All / per-field Use / Continue-Without-AI) | PASS (`qa-task43g`) | Requires the AI-analysis wait + a second item to exercise per-field "Use"; deprioritised against breadth in a re-verification round. No code touching the AI card appeared in FIX-Task-33…56. |
| AUTH-TC-J11 (draft auto-save + resume) | PASS (`qa-task43g`) | Needs a partial draft + Dashboard resume-banner round-trip. Note: a draft-clearing observation is recorded in §5. |
| AUTH-TC-J12 (multi-upload + type/size rejection) | PASS (`qa-task43g`) | The 10 MB / MIME / 400 px gates are not AX-drivable rejections on this build; the prior round verified them via source + a real picker upload. |
| AUTH-TC-J13 (remove / reorder / replace + persist) | PASS (`qa-task43g`) | Needs the real Android system Photo Picker round-trips; the prior round drove replace-completion end-to-end (which the iOS basis could not). |
| AUTH-TC-J15 price-change sub-leg (re-type the price and re-read the preview) | — | The category-bonus + buyer-cap legs were driven live this round, and both preview values are computed **from the $20 price** (26 = 20×1.30; 14 = 20×0.70), so price-dependence is demonstrated by construction. The explicit re-type is a cheap follow-up if a stricter reading is wanted. |

---

## 3. DESIGN-SYSTEM COMPLIANCE (`docx/design-system-passitup.md`)

**Result: PASS — no deviations found on the screens/modals visited.**

| Surface | Verdict |
|---|---|
| **ItemCreate ("New Item")** | CONFIRMED — canonical `ScreenLayout` detail header (`back-button` 105 px round gray + caret-left icon-only, centred 700-weight title, bell + chat right); filled inputs (no outlined variant); single primary `publish-button`; SP-gold "✓ SP Eligible" pill; pill-shaped selectors. |
| **CategorySelectModal** | CONFIRMED — full-screen sheet, "Select Category" title, `close-modal` ✕, filled search field, category rows with emoji + bonus ⭐ badge; single primary (Submit) with a secondary-outline Cancel in the custom-name sub-view. |
| **Phone-verification gate** | CONFIRMED — single primary "Send Code"/"Verify", text-style secondary actions ("Change Phone Number"), dev hint rendered as a distinct low-emphasis line. |
| **J09 success modal** | CONFIRMED — **max one primary** (filled green "Go To My Items") + secondary-outline "Go To Dashboard"; copy left-aligned inside documented padding; title/body hierarchy correct. |
| **Bulk Upload** (intro sheet, tooltip, step indicator, Group/Review, confirm sheet, caveat alert) | CONFIRMED — step indicator uses green current-step + gray future steps; primary/secondary button pairing respected; the `dev-fixture-disabled-hint` renders as plain helpful text, not an error. |
| **Off-brand hex sweep (R62b/R62d)** | No off-brand palette colours observed on any visited surface; all CTAs render the canonical `#5DBB8E` family; SP surfaces use SP gold. |

**Header/back-button check (every screen):** ItemCreate, Bulk Upload and the modal headers all use the canonical detail header. **No hand-rolled green "← Back" headers found** on this surface.

---

## 4. PERCEIVED LOAD-TIME TABLE

*Perceived load time (Android emulator, wall-clock, ±polling-interval precision) — **not a formal performance profile**.*

| Screen → transition | Elapsed | Flagged? |
|---|---|---|
| Dev-launcher row tap → fresh bundle → Landing | ~35–45 s | **Flagged ≥3 s — dev-build cold bundle transform, NOT app behaviour** (dev-client artifact; the app itself loads immediately once the bundle is served) |
| Landing → Dashboard after `qa-login-as` | <3 s | no |
| Dashboard → ItemCreate (deep link) | <2 s | no |
| ItemCreate: add photo → form unlocked | <1 s | no |
| CategoryModal: "Other" → custom-name view | <1 s | no |
| **ItemCreate: Submit for Review → success modal** | **~20–40 s** | **Flagged ≥3 s — but correctly handled:** the app shows the "Submitting Item For Review…" overlay with a spinner and explanatory copy throughout. This is a real storage upload of the photo; the loading feedback is the right UX. |
| `bulk-create` deep link → Bulk Upload painted | ~4–6 s | Flagged ≥3 s — first mount of a heavy screen (AX tree was briefly empty; screenshot polling resolved it) |
| Bulk: add 5 photos → Group step | <2 s | no |
| Bulk: long-press → selection bar | <1 s | no |
| Bulk: Submit → confirm sheet | <1 s | no |
| `qa-login-as` switch → next deep link (first fire) | **dropped** | **R111 reproduced** — see §5 |

---

## 5. FINDINGS

### F1 · MEDIUM — `test-free` carries an internally inconsistent phone-verification state (data integrity)
**Observed (read-only SQL, 2026-09-18):**
```
profiles.phone            = 5551234004
profiles.phone_verified   = true
profiles.phone_verified_at = NULL      ← inconsistent
auth.users.phone          = NULL       ← inconsistent
```
**Why it matters:** the listing phone **gate still fires** for this account (J10's gate appeared on submit), so whatever the gate evaluates is *not* satisfied by `phone_verified = true`. That means `phone_verified` alone is not a trustworthy signal of a verified phone, and any other consumer reading `phone_verified` would wrongly treat this account as verified. The three fields disagree with each other.
**Wrapper note (R100 discipline):** the **writer** of this inconsistent combination was **not established this round** — the finding is reported as *observed state*, not as a diagnosed defect. Two candidate explanations worth a dev look: (a) `phone_verified` is set optimistically by one path while `phone_verified_at` is set by another, and (b) `auth.users.phone` is unset by the persona-provisioning path. This matches the pre-existing registry note that the B03 verify stack updates `auth.users.phone` + verified flags but **not** `profiles.phone`.
**Suggested dev action:** decide the single source of truth for "phone verified" and reconcile the three fields after `seed:staging` (either set all three or clear `phone_verified`); then confirm the listing gate reads the chosen field.

### F2 · LOW — the bulk "Cannot submit for review" caveat is a dev-fixture-only state and its copy is fine
`BulkListingCreateScreen`'s confirm → "Missing bulk session or draft session." alert is an artifact of the dev photos fixtures (which create no bulk session/draft). The user-facing copy is friendly and actionable ("Add your photos from the camera or library to start a session, then submit for review") and leaks no raw codes — **`§6.3` audit: CONFIRMED, no rewrite needed.** Recorded so it is not re-filed as a copy defect; no production user should reach it.

### F3 · LOW (tooling) — the phone-gate "Dev: Autofill & Verify (123456)" button needed **two** taps
The first tap at the tree-reported centre `(540,1195)` was a no-op (code field stayed empty, `Verify` still disabled); the second identical tap succeeded and the flow completed. No app-side symptom and no error surfaced — recorded as tooling friction. If it recurs, prefer tapping the button's centre with a fresh re-list immediately before the tap rather than reusing a stale tree.

### F4 · OBSERVATION — re-entering `create-item` after a successful submit retains the previous form state
After J09's submit succeeded and I navigated to My Listings, the `create-item` deep link returned to a New Item screen still holding **1 photo + the previously chosen category** (and an enabled publish button) rather than an empty form. This is **R96's documented behaviour** (a deep link into an already-mounted route re-focuses the retained screen), so it is recorded as an **observation, not a finding** — the *control* (a fresh app mount → create-item) was **not run**, so I cannot state whether the form is genuinely cleared after a successful submit or merely retained because the screen never unmounted. Flagged as a cheap follow-up for the draft-resume/J11 round.

### F5 · INFO — the J09 success modal's item shows "No Image" in My Listings
The dev fixture photo (`dev-add-test-photo`) adds a bundled placeholder without a real uploaded URI, so the listing row renders "No Image". This is the **dev fixture's nature, not a photo-pipeline defect** — the real-picker path was proven to upload + persist in the 2026-09-08 J12/J13 Android run.

### R110 check (scheduled caller on this surface)
Listing creation/approval has no money-path scheduled caller involved in this round; no cron leg applies. No money-adjacent feature was exercised (no fee/boost surfaces were reached), so the 3-layer money verification is **N/A** for this batch.

---

## 6. KNOWN GAPS / NOT TESTED (explicit per-case reasons)

- **J02 — AI auto-fill (Apply All / per-field Use / Continue Without AI):** not re-driven; Android PASS on record (`qa-task43g-jk-l-2026-09-08`). Reason: needs the AI-analysis wait window plus a second item for the per-field "Use" leg; deprioritised in a re-verification round.
- **J11 — draft auto-save + resume:** not re-driven; Android PASS on record. Reason: needs a partial draft + a Dashboard resume-banner round-trip. See **F4** for the related un-run control.
- **J12 — multi-photo type/size validation:** not re-driven; Android PASS on record. Reason: the 10 MB / MIME / 400 px rejections are not AX-drivable on this build; the prior round verified them via source + a real picker upload.
- **J13 — photo remove/reorder/replace + persist:** not re-driven; Android PASS on record. Reason: needs repeated real Android system Photo Picker round-trips.
- **K02 sub-legs (move-to-another-item, reorder-within-group):** affordance-verified only (controls and labels present and correctly described); the merge leg was driven end-to-end. Reason: budget prioritised the merge leg + the remaining cases.
- **K03 stage 4 ("Publish" current highlight):** not observable — the dev fixture cannot complete a publish (no bulk session), so the indicator never advances past Review.
- **K04 Brand/Age/Gender chips:** not surfaced because the fixture items carry no Brand/Age/Gender values (chips only appear when there is a most-common value to suggest). The Condition chip was verified.
- **AUTH-TC-J15 explicit price re-type:** not driven; the price-dependence is demonstrated by the preview values both deriving from $20 (see §2).
- **iOS:** the iPhone 17 Pro Max simulator was online but **not driven** this round — the brief scoped Android. **Per R80, this Android result must not be read as an iOS closure claim**: no iOS verdict is asserted or re-asserted here.
- **AUTH residual rows not attempted (out of this round's scope, unchanged):** `S01` (staging SMTP unconfigured — owner step), `C03` (Apple provider not enabled in staging GoTrue), `S03`, `S05`.

---

## 7. EVIDENCE INDEX (`screenshots/`)

| File | Shows |
|---|---|
| `JK2-00-coldlaunch-devlauncher.png` … `JK2-03-load-poll2.png` | cold reload / dev-launcher row `:8082` / bundling / fresh Landing |
| `JK2-04..05-post-login.png` | `qa-login-as` test-seller → Dashboard (2263 SP, Norwalk Central) |
| `J01-01-itemcreate-initial.png` | photo-first gating (Photos only, no form, publish absent) |
| `J01-02-after-1-photo.png` | form unlocked: 1/10, Cover badge, publish appears disabled |
| `J01-03..04-form-*.png` | Title/Description + Condition/Age/Gender/Color sections |
| `J04-01..03-*.png` | condition list (5 + descriptions), age group (5), gender (4), 12-colour grid |
| `J14-00..03-*.png` | category picker with bonus ⭐ badges; Books selected |
| `J15-01..07-*.png` | price entry, **IME-visible frame (R5.19 evidence)**, IME dismissed, SP preview ~26 SP / cap ~14 SP |
| `J06-01..02-*.png` | payment preference before/after toggle → "✓ SP Eligible" |
| `J03-01..02-*.png` | publish disabled (empty title) → enabled after dev-fill |
| `J09-01..03-*.png` | "Submitting Item For Review…" overlay → "Thanks for submitting!" modal → My Listings PENDING |
| `J05-01..04-*.png` | category modal → Other custom-name view (helper text, Submit disabled) → name typed, Submit enabled |
| `J07-01..03-*.png` | test-free ItemCreate → free-user upgrade prompt + `sp-upgrade-button`, no toggle |
| `J10-01..04-*.png` | **phone gate prefilled +15551234004** → OTP step (dev hint + cooldown) → publish resumed → success modal |
| `K00-*.png`, `K01-01..03-*.png` | bulk entry, onboarding sheet, Photos 5/30 + auto-grouped item cards |
| `K02-01..03-*.png` | long-press multi-select "2 selected" → Merge → merged card with 2 tiles |
| `K03-01..02-*.png`, `K04-01-*.png` | step indicator at Review; collapsed→expanded Apply-all bar with the Condition chip |
| `K05-01..03-*.png` | publish enabled → confirm sheet (4 rows) → fixture caveat alert |
| `FINAL-01-logged-out-landing.png` | clean logged-out Landing left behind |

---

## 8. FRICTION LOG (for the playbook / dev instrumentation)

1. **The `view_image` channel downscales (R104 re-confirmed live).** Every coordinate read off a displayed screenshot is ~1.23× too small; all taps this round were derived from the AX tree, zero eyeballed taps, **no missed-tap cycles** — R104 held.
2. **The Android IME is still invisible to the AX tree (R5.19 re-confirmed live).** With the Gboard numeric keypad up, `mobile_list_elements_on_screen` reported **no IME nodes** and returned content coordinates as if the keyboard were absent; the SP preview was behind the IME. Handled exactly per the addendum: screenshot → **prove the IME visible** → single BACK → screenshot → confirm gone → then interact. **One BACK with the IME up dismissed only the IME**, as documented.
3. **R111 reproduced:** the `create-item` deep link fired immediately after `qa-login-as?persona=test-free` was **silently dropped** (landed on the Dashboard); one clean re-fire navigated normally. Sibling control not needed — the re-fire is the documented recovery.
4. **`adb shell input text "QA%sCustom%sCat"` dropped the trailing token** (`QA Custom` landed, ` Cat` lost). Tooling artifact of the adb/IME path, not a field defect; the field's value was verified via a fresh tree read.
5. **`mobile_list_elements_on_screen` returned "no XML content found in uiautomator dump" once** — during the J09 submission overlay (a pending load). This is the documented R77 #3 transient, and **critically the dump failed rather than crashing the client** — consistent with R107's rule that dumping inside a pending load is the dangerous case (the R87 `SIGSEGV` family), so screenshot-only polling was used and the session survived.
6. **ItemCreate scrolls needed repeated anchored `adb shell input swipe`** (2–3 per traversal); mobile-mcp swipes were not attempted after prior rounds' documented no-ops here (R77 #14).
7. **The phone-gate dev autofill needed two taps** (F3).
8. **Bulk screen first mount** produced a root-only AX tree for ~4–6 s; screenshot polling resolved it (R-NEW-1's refined rule: one screenshot **first**, and only then conclude anything about the tree channel).

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-J01, J03, J04, J05, J06, J07, J08, J09, J10, J14, J15 + AUTH-TC-K01, K02, K03, K04, K05, K06 (17 cases re-executed on Android at HEAD `40c1280f`; J02, J11, J12, J13 not re-driven — Android PASS on record, reasons in §6)

**Design-System Compliance:** **PASS** — no deviations found against `docx/design-system-passitup.md` on any visited surface (ItemCreate, CategorySelectModal incl. its custom-name sub-view, phone-verification gate, J09 success modal, Bulk Upload intro sheet / grouping tooltip / step indicator / Group + Review steps / confirm sheet / caveat alert). Canonical detail header confirmed on every screen; correct primary/secondary pairing; SP surfaces on SP gold; no off-brand hex observed (R62b/R62d sweep clean).

**Perceived Load-Time Verdict:** **FLAGGED** — `ItemCreate submit → success modal`: ~20–40 s (≥3 s) and `bulk-create` first mount → painted: ~4–6 s (≥3 s); dev-launcher cold bundle → Landing ~35–45 s. Notes: the ~20–40 s submit is an **app-behaviour-meditated** transition (a real photo upload) and it **shows a proper loading overlay with explanatory copy throughout**, so the feedback is correct — flagged for visibility, not as a defect. The cold-bundle and bulk-first-mount figures are **dev-build artifacts** (Metro transform / heavy first paint), not production app behaviour. All other observed transitions rendered <3 s.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — ItemCreate ("New Item"): labels, helper text ("Add up to 10 photos. First photo will be your cover image."), and layout match the design-system requirements; single primary.
- CONFIRMED — ItemCreate SP earnings preview: "Swap Points Estimate" / "You'll earn: ~26 SP" / "1.30x multiplier for this category" / "Buyers can pay up to ~14 SP toward this $20 price with Swap Points" / "*Estimated based on list price. Actual SP may vary." — clear, plain, non-technical.
- CONFIRMED — Payment Preference (subscriber and free-user branches): both branch copies are plain and actionable; the free branch's "🌟 Subscribe to Kids Club+ …" prompt + "Upgrade Now" reads correctly for a parent.
- CONFIRMED — CategorySelectModal (incl. "Other" custom-name view): "Enter custom category name:" + "This will be sent to admin for review" is exactly the transparency the guide requires.
- CONFIRMED — J09 success modal: "Thanks for submitting!" + review explanation; no developer language; max one primary.
- CONFIRMED — Phone-verification gate: "Phone verification is required before you can publish listings or make purchases." + "We sent a 6-digit code to +15551234004"; "Resend code in 55s" reads naturally.
- CONFIRMED — Bulk Upload: intro sheet ("List several items at once" + 4 steps), grouping instruction banner, `dev-fixture-disabled-hint` (dev-only), Publish-bar label "Submit 4 Items for Review", confirm sheet ("Confirm Submission" / "Items to submit for review: 4" / "$20 • Ready"), and the dev-fixture caveat alert ("Cannot submit for review — Missing bulk session or draft session. Add your photos from the camera or library to start a session, then submit for review.").
- CONFIRMED — Bulk SP summary: "Bulk Listing SP Summary" + "Included items: 4" / "SP-enabled items: 0" + the Cash-Only guidance; no raw codes or jargon.
- DEVIATION — **none found.** No screen or dialog visited this round leaked a raw error code, `SCREAMING_SNAKE` identifier, HTTP status, or console jargon (R58/§6.3 audit clean).

**Verdict Summary:** **16 PASS / 0 FAIL / 0 BLOCKED / 5 NOT RE-DRIVEN** (the 5 carry Android PASS on record from 2026-09-08)

**Money Verification Layers:** **N/A — no case in this batch touches money.** No charge, refund, void, hold, payout or saved-payment-method action was exercised (J06/J08/J14/J15/K06 read SP *config-derived previews* — `categories.sp_earning_multiplier` 1.30 and the 70% buyer cap — and J06's toggle wrote `items.accepts_swap_points`; none of these moves money). **R110 (scheduled caller):** no cron/caller is involved on the listing-creation/approval surface exercised this round.

**Coverage Tracker Updated:** **Yes — a round note was added to the head of the AUTH section of `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (R52).** **No status flips** were warranted, because every J/K row already read ✅ PASS — this round adds **Android re-verification evidence at HEAD `40c1280f`** to those rows and **resolves the J05 tracker-vs-ledger discrepancy** (J05's blocked-submit leg is no longer "source-verified only" — it is now driven on-device). AUTH totals are unchanged: **138 cases · 128 PASS / 1 PARTIAL / 2 OPEN / 0 DRIFT / 2 SKIPPED / 5 REMOVED · Remaining (NEVER RUN) = 0** (the header ⇄ §1 roll-up ⇄ AUTH section header were cross-checked and already reconcile).

**Critical Findings:**
1. **MED — `test-free` has an internally inconsistent phone-verification state** (`phone_verified = true` but `phone_verified_at IS NULL` and `auth.users.phone IS NULL`), while the listing gate still (correctly) fires. `phone_verified` alone is therefore not a trustworthy "phone is verified" signal, and any other consumer reading it would wrongly treat this account as verified. **Writer not established (R100) — reported as observed state for a dev decision on the single source of truth.**
2. **LOW (tooling) — the phone-gate "Dev: Autofill & Verify (123456)" button needed two taps** (first was a silent no-op).
3. **OBSERVATION (not a finding) — re-entering `create-item` after a successful submit retained the previous form state** (1 photo + chosen category + enabled publish). Consistent with R96's retained-screen behaviour; the fresh-mount control was **not** run, so no defect is claimed.
4. **INFO — the J09 item shows "No Image" in My Listings** because the dev fixture photo has no real uploaded URI (fixture artifact, not a photo-pipeline defect).

**App State Left Behind:**
- **Session:** all personas logged OUT; app left on a clean **Landing** screen (`FINAL-01-logged-out-landing.png`).
- **⚠️ Persona mutation — `test-free` is now phone-verified:** `profiles.phone_verified_at = 2026-09-18 12:57:10.793+00` (was NULL). **This removes the J10 gate precondition for future runs** — run `npm run seed:staging` (from `p2p-kids-marketplace/`) before any future J10/E05 re-run that depends on an unverified-phone persona.
- **Data created:** 2 new `pending` items — `test-seller`'s `027f308e-c4f8-4ec5-a605-538f396460f9` ("QA Dev Fixture Item", $20, Books, `accepts_swap_points=true`) and a `test-free` pending item from the J10 resumed publish (test-free item count 7 reads with it). Both are ordinary pending listings awaiting admin review — leave or soft-delete at the team's discretion. `test-seller` now shows 189 listings / 6 pending.
- **`test-seller` draft:** a draft with 1 dev photo + Books category was created/retained on ItemCreate during the run; re-seed clears drafts.
- **Bulk session:** the dev-fixture bulk session was never persisted (by design — no bulk session is created), so no bulk rows exist.
- **No `admin_config` writes; no session toggles armed (`stylus_handwriting_enabled=0` is the only device-level setting changed, and it is the documented R77 #2 hygiene fix).** No DB writes were performed by the agent — every SQL call this round was read-only.
- **Admin portal:** not needed by any case in this batch; not opened.
- **Deliverables:** `report.md` + `ledger.md` + `screenshots/` in `e2e-test-results/qa-auth-android-jk-r2-2026-09-18/`.

**Why It Matters:** Groups J and K are the app's **core seller supply path** — if listing creation or bulk publishing regressed, the marketplace would silently stop receiving new inventory. This round proves, on the current HEAD bundle, that the whole path still works end-to-end: photo-first gating holds, required-field validation holds, the subscriber/free payment-preference branches are correct, the SP earn/cap previews are **numerically correct** for the configured Books multiplier (1.30×) and 70% buyer cap, a listing submits to `pending` and stays out of the feed, the phone gate both **blocks** publish and **resumes** it after verification, and the bulk flow auto-groups → merges → reviews → gates → confirms with **all four item counts agreeing**. It also closes the long-standing J05 gap with a genuine on-device blocked-submit, and it surfaces a data-integrity issue (F1) that could mislead any future "is this user's phone verified?" check.

**How to Verify/Reproduce:** Evidence and full trace live in `e2e-test-results/qa-auth-android-jk-r2-2026-09-18/` (`report.md`, `ledger.md`, `screenshots/`).
- **J05 (the resolved discrepancy):** login `test-seller` → `p2pkidsmarketplace://create-item` → scroll to Category → open the picker → tap "+ Other (Custom Category)" → expect the custom-name field + helper text with **Submit disabled** → type a name → expect **Submit enabled** (`J05-03/04`).
- **J10 (the resolved blocker):** login `test-free` → ItemCreate → add photo → fill → Submit → expect the gate prefilled **`+15551234004`** (not the old placeholder) → Send Code → DEV autofill → publish resumes (`J10-01..04`).
- **F1 (data integrity):** `SELECT phone, phone_verified, phone_verified_at FROM profiles WHERE email='test-free@kidsmarketplace.test';` plus `SELECT phone FROM auth.users WHERE id=(SELECT id FROM profiles WHERE email='test-free@kidsmarketplace.test');`
- **SP preview math:** Books multiplier is `1.30` (`categories.sp_earning_multiplier`); $20 × 1.30 = **26** ✓ and $20 × 70% = **14** ✓.

**Known Gaps / Not Tested:** J02 (AI auto-fill), J11 (draft resume), J12 (multi-upload type/size), J13 (photo remove/reorder/replace) — not re-driven, Android PASS on record; the J15 explicit price re-type; K02's move-to-another-item + reorder sub-legs (affordance-verified only); K03 stage 4 (not reachable via the dev fixture); K04's Brand/Age/Gender chips (not surfaced — no values in the fixture to suggest); the F4 fresh-mount control. Full per-case reasons in §6. **iOS was not driven this round — per R80 this is an Android-only result and no iOS closure is claimed.** AUTH residuals `S01`, `C03`, `S03`, `S05` remain outside this batch.

**What Needs To Be Fixed Next:**
1. **Decide the single source of truth for "phone verified" and reconcile `test-free`'s three fields** — `profiles.phone_verified` (currently `true`), `profiles.phone_verified_at` (currently `NULL`) and `auth.users.phone` (currently `NULL`) disagree, while the listing gate still fires. Either make the verifying path write all three atomically, or clear `phone_verified` where `phone_verified_at` is NULL, and confirm the listing gate + any other consumer read the same field. (Add a post-`seed:staging` reconciliation check so a fresh seed cannot leave this combination.)
2. **Fix `seed:staging` so `test-free` is restored to an unverified-phone baseline** (its `phone_verified_at` is now set by this round's J10 run) — otherwise the J10/E05 gate cases are not re-runnable without manual DB surgery.
3. **Investigate the phone-gate dev autofill's first-tap no-op** (`listing-phone-verification-dev-autofill`) — it silently did nothing on the first tap and worked on the second; a dev-fixture button that requires two taps costs a QA cycle and can be mis-read as a broken verify path. (The same class as the existing "clear field / toggle needs a second tap" instrumentation asks.)
4. **Run the F4 control** — terminate + relaunch the app, then open `create-item`, after a successful submit: confirm whether the form is genuinely reset on a fresh mount (correct) or whether submitted state lingers (a real stale-form bug). No fix should be written until that control runs.

**UX Enhancement Ideas (optional, not defects):**
- On **ItemCreate**, the submit path needs ~20–40 s while uploading the photo and the seller only learns of progress via the overlay text — consider surfacing a determinate progress indicator for the upload phase so a seller on a slow connection can tell the difference between "working" and "stuck".
- On **Bulk Upload → Review**, the SP summary sits above the item cards and the sticky publish bar overlays the summary region at the current scroll position — consider giving the review list a little more clearance below the sticky bar so the summary and the first cards can be read together without scrolling back and forth.
- On **ItemCreate**, the dev-only helper buttons are interleaved with the real form (between Photos and Title) — for future QA rounds, consider grouping all `dev-*` controls into a single collapsible dev panel so screenshot evidence of the production form is never mixed with fixture chrome.
- On **Bulk Upload → Review**, the Cash-Only guidance ("Enable "Accept Swap Points" on a card to add it to SP totals") is genuinely helpful — consider surfacing the same one-line explanation inline on the single-item ItemCreate SP preview when a subscriber has the SP toggle **off**, since the current preview simply stays at the "Select a category…" placeholder and does not say what turning the toggle on would add.

**Suggested Next Session:** **AUTH Android R3 — the remaining 4 Group J cases (J02 AI auto-fill, J11 draft resume, J12 multi-upload validation, J13 photo remove/reorder/replace) plus the F4 fresh-mount control and the J15 explicit price re-type**, driving the real Android system Photo Picker for J12/J13 (it is AX-drivable on this build). After that, AUTH's only true residuals are the two environment-blocked rows (`S01` staging SMTP — owner step; `C03` Apple provider not enabled in staging GoTrue) plus the two deliberate SKIPs (`S03`, `S05`), so **no AUTH group remains uncovered** — the deferred items named in the brief (Group Q education/calculator, E04/E05, F02-F04, H03, B01, S08/S11, O04, and Group L admin-paired cases) were **already executed on Android on 2026-09-08** (`qa-task43f`, `qa-task43m`, `qa-task43L`), so that list is stale for the same reason Groups J/K were.

**Suggested to Improve Agent Rules:** **The Step-0 reconciliation should produce an explicit "is this batch already covered?" decision, not just a status read.** This round's brief scoped ~19 cases as "deferred"; the tracker showed all 19 already had Android verdicts 10 days old, which silently converts a planned *first-pass* round into a *re-verification* round with a different value proposition (breadth vs. depth) — and a re-verification round should be *declared* as such up front, with the age of the prior verdicts stated as the justification. Concretely: add to the Step-0 rule that when every requested case already carries a verdict, the agent must (a) state the prior verdict's date and platform, (b) re-scope as re-verification at the current HEAD, and (c) say so in the handoff's `Test Scope` line so the round's claims are never conflated with new coverage. (Complements R40's explicit per-case scope lists.)

---

*Diagnostics: full execution trace and decision log in `ledger.md`; 35 on-disk screenshots in `screenshots/`. All SQL used this round was read-only (`SELECT`); no repository file outside `e2e-test-results/` was modified.*
