# FIX-Task-61 — Photo Validation Gap (J12) + Doc Drift + UX Enhancements

**Date:** 2026-09-18 · **Source:** AUTH Android Round 3, 2026-09-18 (`e2e-test-results/qa-auth-android-jk-r3-2026-09-18/`, FINDING F1) · **Platform verified:** Android emulator (`Medium_Phone_API_36.1`, API 36.1) against live staging + local migration replay

**Evidence:** `e2e-test-results/fix-task-61-2026-09-18/evidence/` (34 screenshots) · unit logs at `/tmp/fix61-unit-run.log`, `/tmp/fix61-unit-final.log`

---

## 0. Stance on the reported finding (§9.1a)

**CONFIRMED — both limbs.** F1 was a real, two-part defect, and the second limb had a wider blast radius than the report implied.

| F1 limb | Verdict | How established |
|---|---|---|
| 1 — draft path rejects silently | **CONFIRMED** | Source trace (`uploadPhotos` handled `result.errors` with `captureException` only) **and** re-driven on-device with the exact repro (oversize PNG + GIF via the real system picker). |
| 2 — publish path validates nothing | **CONFIRMED** | Source trace: `uploadListingImages` validated only `imageUris.length > 10`. It is the **sole production caller** of the upload path from `ItemCreateScreen`, and it received bare URI strings — so it could not have applied a size/MIME check even if someone had tried to add one there. |

**A third, previously-unreported defect was found while fixing limb 2** and is fixed in the same change (§6a): `validatePhoto` **failed open** — both the size and the MIME check sat inside `if (asset.fileSize)` / `if (asset.mimeType)`, so a picker asset with no metadata was accepted unconditionally. This is why the oversize file could only be caught when the picker happened to supply `fileSize`.

---

## 1. Item 1 — [HIGH] Surface a user-facing rejection on ItemCreate

**Before:** `ItemCreateScreen.uploadPhotos()` sent `uploadPhotoBatch`'s `errors[]` to telemetry only. An oversize PNG and a GIF were added to the strip (4/10 photos) with zero feedback.

**After:**
- `uploadPhotos` derives each photo's outcome **once** and uses it for both the draft's `photo_urls` map and a new per-slot state map (`photoUploadStates`), so the strip and the published set can never disagree (BP-92).
- A rejection now raises a blocking dialog with **one line per rejected photo**, using copy shared with the Bulk screen (extracted, not duplicated — §8).
- A **new**-file helper carries the ItemCreate wording (rejected photos are *not* skipped — they stay and block publish).

**On-device proof (evidence 12, 13):**

```
Uploads failed
2 photos can't be uploaded
- 87829da7-10b0-4c54-b068-ca7f500b91ec.gif: Only JPEG, PNG, WebP, and HEIC images are supported
- 99b3230a-7d0c-436f-ae9e-b0bee4cc7a69.png: Image must be smaller than 10MB
Remove or replace them, then try again.
```

**Owner decision honoured:** the rejected photo is **not** silently removed — it stays visible, badged (§4), and blocks Publish (§9 below). Choosing "remove immediately" was rejected because it contradicts item 4's stated goal.

---

## 2. Item 2 — [HIGH] Close the publish-path validation bypass

`uploadListingImages` now enforces the same contract as the draft path, **before any upload or DB write**:

- Signature widened to `(string | PhotoAsset)[]` — **backward compatible**; the existing `string[]` callers and their tests are untouched.
- Normalised to `{ uri, asset? }`, then `assertLocalImagesSatisfyContract` validates **every** local entry up front.
- Metadata wins when the caller has it; otherwise MIME comes from the URI extension and size from the filesystem (`getLocalImageSizeBytes`).
- Remote/draft-resume URLs skip validation (already uploaded).
- Fails **before** the loop, so a rejected photo can never leave a half-uploaded listing behind (the loop inserts `item_images` rows as it goes).

`ItemCreateScreen.handlePublish` now passes `photos` (the `PhotoAsset` objects) instead of `photos.map(p => p.uri)`.

**Proof (required by the deliverable):** `src/services/__tests__/listing-upload-images.test.ts` → 4 rejection cases + **1 positive control**:

| Case | Assertion |
|---|---|
| Oversize via asset metadata | rejects `Photo 1 can't be uploaded: Image must be smaller than 10MB`; `uploadImage` NOT called; no `item_images` write |
| Wrong type via URI (`.gif`) | rejects with the MIME message; `uploadImage` NOT called |
| Oversize measured from disk (no metadata) | rejects; `uploadImage` NOT called |
| Invalid photo in a **later** position | rejects naming `Photo 2`; the valid first photo is **not** uploaded either (fail-fast) |
| **Positive control** | a valid photo still uploads and returns 1 image |

The positive control exists so the guard cannot pass by simply always throwing.

---

## 3. Item 3 — [LOW] AUTH guide doc drift on J02 ✅

Single canonical file edited, per the QA playbook's canonical-source rule:

`cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`

- **L1075** rewritten: "Continue Without AI" is available **immediately** inside the overlay; the ~7 s mark is when the overlay **auto-releases** (`AI_ANALYSIS_BLOCKING_TIMEOUT_MS = 7000`). Split into two bullets so the timing claim and the failure-branch claim no longer share a sentence. Inline amendment parenthetical added in house style.
- **L5** `**Last updated:**` extended with the dated summary.
- Claimed strings verified against source before writing: the overlay title literal is `Analyzing Your Photos...` (three periods) at `ItemCreateScreen.tsx:1932`, the button `testID` is inside that modal at `:1943`, and the timeout constant is at `:106`.
- **No flow-registry entry** — `docs/flow-registry.md` L8 explicitly forbids dated change history there (rule §14A).
- The two stale duplicates (repo root, `archive/misc./`) were deliberately **not** touched.
- `node scripts/check-guide-drift.mjs` does **not** catch this class of drift (it only compares index rows ↔ headings and tracker Notes ↔ Status) — noted as a gap, not fixed.

---

## 4. Item 4 — [UX] Per-slot "Couldn't upload" affordance ✅

`PhotoUploadManager` gained an optional `uploadStates?: Record<string, PhotoUploadState>` prop rendering:

- **`failed`** → thumbnail dimmed (opacity 0.45) + red badge **"Couldn't upload"** (`testID="photo-slot-failed-<photoId>"`), with the rejection reason in its `accessibilityLabel` so the reason is retrievable from the accessibility tree.
- **`uploading`** → subtle dark badge **"Uploading…"** (`testID="photo-slot-uploading-<photoId>"`).

Notes:
- Badge band is positioned at `top: 28` so it collides with neither the Cover badge/remove button (top: 4) nor the reorder/replace chips (bottom: 4).
- The badge colour is `#C62828` — matching ItemCreate's existing error-card family on this screen. The `#E85D75` error token was rejected here because white 9px text on it falls below AA contrast.
- Backwards compatible: omitting the prop renders exactly as before, and a photo with no entry shows no badge (asserted).
- The label lives in an exported constant (`PHOTO_UPLOAD_FAILED_LABEL`) so UI, tests and instrumentation assert one literal.

**On-device proof:** evidence 13 (both slots badged + dimmed, with the inline notice card), evidence 20 (the "Uploading…" state on a third slot mid-flight).

---

## 5. Item 5 — [UX] "Details" affordance on the AI error card ✅

A **second** mapper was added rather than exposing the raw string: `getAiErrorDetail(raw)` returns a plain-language cause **plus a short technical reference**, mirroring the existing five categories so the two mappers can never classify one failure differently.

**On-device proof (evidence 32 collapsed → 34 expanded):**

```
Photo analysis issue
Photo analysis is temporarily unavailable. Please try again later or fill in the details manually.
Details                     ← low-emphasis, underlined, collapsed by default
[Try Again]
```
After tapping:
```
Hide details
The photo analysis service rejected our request — its provider credential is invalid,
expired, or out of quota (technical reference: 401/403 authorization error).
```

- No raw JSON, no `UNAUTHORIZED`, no bearer token reaches the parent — asserted in both a unit test and the on-device capture.
- The disclosure is only rendered when a detail exists (`null` ⇒ no affordance), and it collapses on Try Again and on Continue Without AI.
- **Copy note:** the label ships as **"Details"** with "Hide details" as the expanded state — the task left wording to the copy owner; changing it is a one-line edit.
- The friendly copy above it was **not** changed (the task states it is correct).

---

## 6. Owner-approved adjacent fixes

### 6a. `validatePhoto` could fail open (fixed)
Size and MIME are now resolved when the picker omits them, then handed to the shared contract:
- MIME: `asset.mimeType ?? mimeTypeFromUri(asset.uri)` — so a `.gif` source is rejected even with no MIME metadata.
- Size: `asset.fileSize` (if > 0) else an on-disk probe.

Regression tests: 4 cases in `photoService.test.ts`, including **"rejects an oversize photo when the picker omits fileSize"** (the exact shape that slipped through) and **"prefers the picker metadata over the on-disk probe"**.

**Deliberate residual (documented, not hidden):** when size/MIME cannot be resolved by metadata *or* the filesystem probe, the entry is allowed — the Storage bucket, which enforces both limits server-side, remains the backstop. There is a test pinning this behaviour so it is a decision, not an accident. This makes the guarantee *"cannot be bypassed by any in-app path"* rather than mathematically airtight.

### 6b. Storage bucket MIME contract disagreed with the client (fixed)
`supabase/migrations/20260918000009_fix_task_61_item_images_bucket_mime_alignment.sql` (Mode B, idempotent) aligns `storage.buckets.allowed_mime_types` with the client contract:

| | before | after |
|---|---|---|
| `image/gif` | allowed | **removed** |
| `image/heic`, `image/heif` | absent | **added** |

Consequences of the old state: a GIF was rejected **only** by the app (any non-app writer could store one in a listing bucket), and HEIC was accepted by the app but absent server-side — masked today only because the client re-encodes to JPEG.

`file_size_limit` was deliberately **not** re-written (already 10 MB from `20260824000001`); re-setting it would risk clobbering a deliberate operator change.

**Migration evidence:**
- Replay probe after adding the file: **`pass 1: applied 538, deferred 0`, `unresolved 0`** — single-pass, which is what `db reset` requires.
- Local read-back after replay: `item-images | 10485760 | 10 | image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif`.
- **Idempotency proven** by re-running the migration file verbatim (succeeded, emitted its NOTICE).
- **Fail-loud guard proven non-vacuous** by a negative control: the same `DO` block with a bogus bucket id raised `item-images row not found in storage.buckets — MIME allow-list was NOT aligned`.
- **Fidelity gate: 0 NEW findings** — and proven *not* to be mine by a discriminating run (§7).

### 6c. Photo-count constant
`uploadListingImages` and `syncListingImages` now use the shared `MAX_PHOTOS_PER_LISTING` instead of a literal `10`. (The `ItemCreateScreen` selection limit and `PhotoUploadManager`'s display default still use their own literals — deliberately out of scope for this change.)

---

## 7. Regression summary

| Tier | What ran | Result |
|---|---|---|
| **Tier 0** | `npx tsc -p tsconfig.json --noEmit`; `npx eslint` on all 16 changed files | **PASS** — compile clean; lint **0 errors** (46 pre-existing `no-console` warnings only) |
| **Tier 1** | Full Jest suite (`npm test`) + targeted suites + on-device legs | **PASS** (see below) |
| **Tier 2** | Migration replay probe, fidelity gate, DB lint, real invocation of the changed object | **PASS** (see below) |

### Tier 1 detail

- **Full suite:** `Test Suites: 340 executed (338 passed, 2 failed), 54 skipped` · `Tests: 3990 passed, 486 skipped, 0 failed (first run)`.
- **The 2 failures are confirmed staging flakes, not regressions** — `badgeRealtimeIntegration.e2e.ts` (15 s Realtime wait timeout) and `referral-analytics-admin.e2e.ts` (`57014 canceling statement due to statement timeout` from a live RPC). Both **pass in isolation** when re-run. Neither file was touched, and neither can be affected by a client photo-validation change. Per repo policy this is environmental variance, not a code regression.
- **Non-vacuity evidence (§9.1h) — three RED/GREEN pairs, all recorded:**

| Fix | Probe used to disable it | Result |
|---|---|---|
| Publish-path contract | `if (true) return;` at the top of `assertLocalImagesSatisfyContract` | **4 of 5 rejection tests FAILED**, positive control still passed → suite is not vacuous and the guard is not "always throw" |
| `validatePhoto` fail-open closure | restored the pre-fix `asset.mimeType` / `asset.fileSize` passthrough | **exactly the 2 targeted tests FAILED** |
| ItemCreate publish gate | `if (false && rejectedUploadErrors.length > 0)` | **exactly the 1 gate test FAILED** |

All probes were reverted and the tree was grepped for residue (`TEMP-PROBE`, `false &&`) — **CLEAN** — before the final gates were re-run.

### Tier 2 detail

- Replay probe: `applied 538/538`, `deferred 0`, `unresolved 0`.
- **Fidelity gate — a NEW finding appeared and was investigated, not dismissed.** The report went from 135 → 136 hard findings. Classification (§9.1e discipline — reproduce the premise before accepting it):
  - The delta is a single object: `POLICY|profiles|"Allow phone verification updates"` reported as a SUBSET MISS (staging has it, the replay does not). **`conflicts` unchanged at 86, `unexplained` 0.**
  - `20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql` **deliberately drops** that policy (its own comments assert it should be ABSENT).
  - **Discriminating run:** with my migration file temporarily moved out of `supabase/migrations/`, the chain was replayed (537/537) and the fidelity report regenerated — **byte-identical key sets** (50 subset / 86 conflicts / 0 unexplained, no NEW, no GONE). Restored afterwards and re-replayed (538/538).
  - **Conclusion:** the finding is another session's uncommitted migration vs a staging database that has not had that lockdown applied — a deliberate chain-ahead divergence, **0 findings attributable to FIX-Task-61.**
- DB lint (`npx supabase db lint --local`): 57 functions with pre-existing issues; **0 touch storage/buckets**, i.e. nothing from the new migration. Sample pre-existing issue: `check_phone_verification_status` references a non-existent `phone_verification_codes.code` column.

### On-device detail (Android, live staging)

The F1 repro was re-driven **through the real Android system picker** with regenerated fixtures (35.8 MB PNG; 720×720 GIF, ≥400 px so only the MIME gate can trip):

1. Both photos selected → count went to **2/10** and **both slots are badged "Couldn't upload"** (evidence 12, 13).
2. The dialog names **each** rejected photo and its reason (evidence 12).
3. The persistent inline card repeats the reasons with the fix instruction, and survives dialog dismissal (evidence 13).
4. With the form valid (category Books, title, condition, price) and Publish enabled, tapping **Submit for Review** produced the **specific photo blocker** — `Photos couldn't upload` with both reasons — **not** the generic "Missing Fields" (evidence 16). This is the branch-placement decision working: the gate is checked before `canPublish()` precisely so its explanation is reachable.
5. "Uploading…" state observed on a third slot mid-flight (evidence 20).
6. AI error card → **Details** collapsed (evidence 32) → expanded with the 401/403 cause and no raw JSON (evidence 34).

---

## 8. What changed (files)

**Mobile — new**
- `src/constants/photoRules.ts` — dependency-free single source of truth for the size/MIME/dimension contract + `mimeTypeFromUri` + `validatePhotoMetadata`.
- `src/utils/localImageFileSize.ts` — resolves a local file's on-disk byte size; returns `null` when unmeasurable.
- `src/utils/uploadFailureFormat.ts` — `photoLabelFromUri`, plus the Bulk contract (`buildUploadFailureMessage`, moved verbatim) and the ItemCreate contract (`buildRejectedPhotoMessage` / `summarizeRejectedPhotos`).

**Mobile — changed**
- `src/services/photoService.ts` — delegates to the shared contract; **closes the fail-open**; re-exports `MAX_FILE_SIZE_MB`/`PhotoValidation` for backward compatibility (`ImagePickerGrid` imports the constant from here).
- `src/services/listing.ts` — publish-path contract enforcement (fail-fast), union-typed `imageUris`, shared photo-count constant.
- `src/screens/ItemCreateScreen.tsx` — per-slot upload state; rejection dialog; persistent inline notice; publish gate; Details disclosure; passes `PhotoAsset[]` to the publish path; dev fixtures marked `uploaded` in the new state map **only** (so the AI-idle fixture keeps its behaviour and QA publish flows still work).
- `src/components/listing/PhotoUploadManager.tsx` — `uploadStates` prop, per-slot badges, dimming, accessibility labels, exported label constant.
- `src/screens/BulkListingCreateScreen.tsx` — now imports the extracted failure-copy helper (local duplicates deleted; wording/markup unchanged).
- `src/types/listing.ts` — `PhotoUploadStatus` / `PhotoUploadState`.
- `src/utils/aiErrorFormat.ts` — added `getAiErrorDetail` (friendly mapper untouched).

**Docs**
- `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` — J02 corrected + `Last updated` bumped.

**DB**
- `supabase/migrations/20260918000009_fix_task_61_item_images_bucket_mime_alignment.sql` — bucket MIME alignment (**written; NOT applied to staging** — see §10).

**Tests (+42 new cases across 6 suites)**
- New: `src/utils/__tests__/aiErrorFormat.test.ts` (12), `src/utils/__tests__/uploadFailureFormat.test.ts` (10).
- Extended: `listing-upload-images.test.ts` (+5), `photoService.test.ts` (+6), `PhotoUploadManager.test.tsx` (+5), `ItemCreateScreen.test.tsx` (+4).

---

## 9. Still flagged (NOT fixed — needs your decision or an Ops action)

1. **[Ops — re-confirmed live] J02's success limbs remain unverifiable on every platform.** The on-device Details capture (evidence 34) surfaces the *same* downstream 401 the R3 round reported, so the staging AI provider credential is still invalid/expired. `batch-analyze-items` and `analyze-item-image` are deployed; the failure is the provider credential. **Refresh the staging AI provider credential** — no code change will fix this, and J02's success assertions cannot be verified until it is done.
2. **[QA fixture gap] The bundled `assets/qa-media` images are smaller than 400×400**, so the dimension gate rejects them (observed on-device as `Image must be at least 400×400 pixels`). Any QA case that needs a *successful* listing-photo upload cannot use those assets. Either regenerate them ≥400 px or add a dedicated valid fixture. (Pre-existing — the dimension check was always unconditional.)
3. **[Environment, flagged not filed] An ANR (`Pass It Up! isn't responding`) occurred mid-session** on a heavily loaded emulator (30-60 s bundle loads, 20-30 s uploads). It was **not** reproducible against any changed code path, and the change adds no main-thread work (the ANR appeared while a rejection dialog was opening). Recorded as an environment/driver observation; it did **not** block any verification leg (all six were completed afterwards from a clean restart). If it recurs on a quiet device, it deserves its own investigation.
4. **[Pre-existing, low] `PhotoUploadManager`'s Cover badge uses `#4CAF50`** (Material green), not a Pass It Up token — pre-existing, left alone. My new badge uses `#C62828` deliberately (contrast), matching ItemCreate's error-card family rather than introducing a fifth red.
5. **[Not mine — do not commit as part of this task]** The working tree also contains **uncommitted FIX-Task-59 work**: `.github/instructions/supabase-sql.instructions.md`, `p2p-kids-marketplace/package.json`, `src/services/devTestingService.ts`, `src/services/__tests__/verify_user_phone.integration.test.ts`, `scripts/qa/fix-task-59-phone-rpc-lockdown.mjs`, `supabase/migrations/20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql`, and `e2e-test-results/fix-task-59-2026-09-18/`. These were already modified before this session and **explain the fidelity-gate delta in §7**.
6. **[Research correction, recorded so it is not re-derived]** The source-trace pass claimed `src/__tests__/e2e/listing-image-upload.e2e.test.ts` asserts an obsolete `'Maximum 5 images allowed per listing'`. On verification the file asserts `'Maximum 10 images allowed per listing'` (line 180) — the claim was **wrong** and is withdrawn; no fix is owed.

---

## 10. Two-phase provisioning status (BP-80)

| Deliverable | Status |
|---|---|
| Client + doc changes | **Done and verified** |
| Migration **file** | **Written + Tier 0 green + verified locally** (replay 538/538, idempotent re-run, non-vacuous guard, local read-back) |
| Migration **applied to staging** | **APPLIED** — but **not by this task's `apply_migration`**. See §12: staging was already in the target state when checked, and the ledger already carried a row named `fix_task_61_item_images_bucket_mime_alignment` (version `20260918170406`). |
| Corresponding regression tier | Tier 2 *staging* leg: **satisfied** (live read-back in §12). Local legs (replay/fidelity/DB-lint) all ran and passed. |

**Correction (see §12):** the paragraph that previously stood here — "staging still accepts `image/gif` and rejects `image/heic`/`image/heif` at the bucket level" — was **inferred from the migration chain, never read from staging**. Live staging did not match that claim.

---

## 11. Open questions / recommendations

1. ~~Apply `20260918000009` to staging?~~ **Resolved — already applied** (see §12.1). **New question:** who/what applied a migration named `fix_task_61_item_images_bucket_mime_alignment` at 13:04 EDT, given no such file exists in this repo? The resulting state is correct, but the applied artifact's name differs from the chain's, so the provenance should be confirmed before the chain is trusted as the record of what staging runs.
2. **"Details" label** — shipped as-is per the task's copy-is-deferred note; say the word and it becomes "Why?" / "Support info" / etc.
3. **Follow-up worth scheduling:** extend `scripts/check-guide-drift.mjs` to catch *value* drift (numbers/durations) in expected results — it cannot catch the class of defect item 3 fixed, which is exactly why it survived several QA rounds.
4. **Follow-up worth scheduling:** regenerate `assets/qa-media/` at ≥400 px (flag 2) so QA can exercise successful uploads.

---

## 12. Post-apply addendum (same day, follow-up session)

Owner asked for: apply `...0009` to staging → re-run the fidelity gate → drive the successful-upload path (J02).

### 12.1 The migration was ALREADY applied — it was not re-applied here

The instruction's premise ("written, NOT applied") was false by the time it was given, so per the repo's §9.1e discipline (reproduce a dispatched premise before executing its remedy) the remedy was **not** executed as a blind no-op. Evidence:

| Check | Result |
|---|---|
| Live `storage.buckets.allowed_mime_types` **before** any write | `{image/jpeg, image/jpg, image/png, image/webp, image/heic, image/heif}` — **exactly the migration's target** |
| `file_size_limit` | `10485760` (10 MB) — untouched, as designed |
| `.gif` objects in the bucket | **0** |
| Bucket row count | 1 (no duplicate) |
| Staging ledger | Contains `fix_task_61_item_images_bucket_mime_alignment` at version **`20260918170406`** = **17:04:06 UTC = 13:04:06 EDT**, ~3 min before this check |
| Repo file for that version | **Does not exist** — `find` for `*20260918170406*` returns nothing; the repo's file is `20260918000009_…` |

`list_migrations` on this project records **apply timestamps** as `version` (e.g. the 10 MB size-limit file is `20260824000001_…` on disk but `20260824184859` in the ledger), so `20260918170406` is an apply time, not a filename.

**Two consequences the owner should know:**

1. **Provenance is unresolved.** Something applied a migration *under this fix's name* at 13:04 EDT, and whatever file it used is not in this repo. The resulting **state is correct** (verified by value above), so this is not a defect — but the applied artifact and the repo's chain file have **different names**, which is exactly the duplication smell BP-99 warns about. Worth confirming who/what applied it (a parallel session, or a manual dashboard apply).
2. **A claim in this report was wrong, and the cause is instructive.** §9's original wording asserted staging "still accepts `image/gif`". That claim was **derived from the migration chain** (`20260328000100_create_item_images_bucket.sql`), **never read from staging** — the one layer that could falsify it. This is the R100/"name the writer" family: *verify a claim at the layer that can falsify it, not at the layer that merely implies it.* The chain-vs-staging divergence itself is a legitimate BP-100 "chain-ahead/staging-ahead" item; the error was asserting the staging side without reading it.

### 12.2 Fidelity gate re-run — delta UNCHANGED

| Metric | Value |
|---|---|
| Replay probe | `applied 538/538`, `deferred 0`, `unresolved 0` |
| subsetMisses | 50 → 50 (**0 NEW, 0 GONE**) |
| conflicts | 86 → 86 (**0 NEW, 0 GONE**) |
| unexplained | 0 → 0 |
| Total hard findings | 136 (unchanged) |

**Why it cannot change — proven, not assumed:** `allowed_mime_types` appears **0 times** across all three captured staging fingerprints (`/tmp/staging-fp1..3.txt`), and those files contain **zero** `|storage|` rows. A `storage.buckets` row-value edit is therefore *outside the gate's scope by construction* (an instance of BP-100 rule 5's "know what the fingerprint cannot see"). The unchanged delta is the expected result, not a lucky one.

### 12.3 J02 — successful-upload path ✅ VERIFIED; AI success limbs ❌ BLOCKED

Driven on the Android emulator against live staging, with a purpose-built **valid** fixture (1200×1200 PNG, 13 KB — the bundled `qa-media` assets are all <400 px and can never upload):

1. **Upload SUCCEEDED.** The photo reached `1/10` with a **Cover** badge, the transient **"Uploading…"** state was observed, and **no `photo-slot-failed-*` element exists** in the accessibility tree — i.e. the new success path renders correctly and the publish gate is satisfied for a valid photo.
2. **Storage read-back proves it end-to-end:** `drafts/14be337c-…/1789751603142/photo_0_1789751603142.jpg`, created `2026-09-18 17:14:02 UTC` (= 13:14 EDT, the exact moment of the on-device upload), **18,694 bytes**, `mimetype=image/jpeg`. The 4 older objects in that folder are the R3 round's leftovers; **no object was created for any rejected photo**, confirming validation rejects before any upload.
3. **AI analysis still fails** — the card shows the friendly copy, and the new **Details** disclosure reports the 401/403 provider-credential cause, with no raw JSON in the UI.
4. **Raw provider error captured** with a direct Edge Function probe (read-only, publishable key, `HTTP 200`):

```json
{"results":[{"groupId":"fix61-probe","error":"Analysis failed: 401 {\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Invalid or expired bearer token\"}}"}],"totalProcessed":1,"totalFailed":1}
```

**Verdict:** the same downstream 401 as AUTH Android R3 FINDING F2. The app degrades correctly; the failure is **upstream of the code**. **J02's success limbs (Apply All / per-field Use) remain unverifiable on every platform until the staging AI provider credential is refreshed** — an Ops action, not a code fix. Stopped here as instructed.

**Evidence:** `evidence/36`–`43` (ItemCreate open → valid pick → upload in flight → strip with no failure badge → AI card → **Details** expanded).

