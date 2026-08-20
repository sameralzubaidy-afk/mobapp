# Phase 26 — Bulk Four-Fixes Final Verification — Decision & Outcome Log

**Date:** 2026-08-20 · **Agent:** QA Test Agent · **Run dir:** `e2e-test-results/phase26-bulk-four-fixes-verify-2026-08-20/`
**Pair with:** `report.md` (per-item verdicts). This is the process record.

---

## 1. Pre-execution (highest leverage)
- Read playbook + memories; verified commit `315df4d0` present at HEAD, tree clean.
- Source-audited the 4 fixes: `handlePublish` gate hoisted (isPhoneRequired → PhoneVerificationModal `bulk-phone-verification`, required, onSuccess re-invokes handlePublish); AX props on photo-tile/selection/card-toggle/step/publish; reorder wired (`onReorderPhoto` → `reorderPhotoInGroup`, cover tracks `primaryPhotoIndex`); ApplyToAllBar collapsed + `GroupingHelpTooltip` with AsyncStorage flag.
- Mapped every target testID to its component. Conclusion-first: the phone-gate logic + reorder semantics were fully understood pre-device.

## 2. Item 2/3/4 (test-seller) — the AX fix is REAL
- `photo-tile-*` and `selection-*` (merge/move-to-new/delete/clear) **surface in the AX tree** — the two biggest Phase 25 gaps are FIXED. Photo-tile labels even reflect selection state.
- `bulk-item-card-toggle-*`, `bulk-item-exclude-toggle-*` (Switch), `bulk-publish-button` all surface; **exclude switches are now tappable** — the Phase 25 K05 blocker is gone (excluded 4 of 5 items via the switches; button label updated 5→1 live).
- **Item 3 (reorder):** merged two photos → arrows appeared only for valid directions; tapped the cover's move-right → COVER badge (exact 142×45px/5125-px signature) relocated first→second tile; move-left back. Identical badge signature proves "cover follows the photo". PASS.
- **Item 4a:** Apply-to-All bar appears as a single collapsed `apply-to-all-toggle` row; expand → `apply-to-all-age_group` chip; collapse round-trip confirmed via AX state. PASS.

## 3. The one FAIL: `bulk-step-*` still doesn't surface
- The step indicator visually renders on every step (OCR) but `bulk-step-indicator`/`bulk-step-*` never appear in the AX tree — across Photos, Group, and Review steps, multiple fresh listings, final 69-element tree has 0 step nodes. Per the prompt's constraint, reported exactly and NOT worked around → back to dev.

## 4. Item 4b tooltip — flag already consumed
- Read the AsyncStorage manifest in the app container: `@kids_marketplace:bulk_grouping_hint_seen_v1 = "1"` (set by the dev's verification). Tooltip correctly suppressed on every Group entry (confirms one-time behavior). First-show can't be re-observed without clearing the flag (a device-data write outside QA scope → flagged as optional follow-up, not performed).

## 5. Item 1 (phone gate) — the long tail
- Provisioned fresh unverified seller (autofill → skip OTP → relaunch → skip onboarding). DB-checked unverified (wrong-join caveat — see below).
- Drove bulk flow; the hard part was the **nested-form scroll + AX-staleness** on the item-card form (Title/Condition/Price each took several re-derivation rounds; Price required scrolling the INNER form, not the outer list).
- Reached an enabled green Submit → Confirm sheet → **`bulk-phone-verification` modal fired immediately** — the headline Item 1 assertion, confirmed on-device.
- Verification path hit a **backend defect**: `send-phone-otp` returns HTTP 500 — `function gen_salt(unknown) does not exist` (pgcrypto functions only in `extensions` schema; the function's hashOTP call doesn't resolve them — read-only log + SQL evidence). The app's DEV SMS bypass (code 123456) covered it.
- OTP paste character-drop → used the documented digit-by-digit recovery → Verify succeeded → `profiles.phone_verified_at` set (13:27:13.995Z, DB-confirmed) → `handlePublish` re-invoked → gate passed → "Missing bulk session" (fixture limitation) → 0 items created.

## 6. Important DB gotcha (corrected)
- The profiles table keys on **`user_id`**, not `id`. My early "unverified" DB check joined `p.id = au.id` (wrong) and misleadingly returned nulls. The unverified state at start is nonetheless empirically proven by the gate firing (modal appears only when `isPhoneRequired` = true). Corrected queries used `user_id`.

## 7. What consumed time (cross-cutting)
- **AX staleness + nested scroll on the item-card form** (Review step) — the dominant sink (Item 1 form-fill; ~40% of wall-clock).
- `send-phone-otp` 500 + OTP recovery — ~20%.
- ImageMagick/OCR re-derivation for non-AX controls (confirm-sheet buttons, condition chips, edit-grouping) — ~15%.

## 8. Patterns that worked
- **Conclude from source/DB first, confirm on-device** — the phone-gate logic, reorder semantics, and backend `gen_salt` defect were all understood before the relevant device step.
- **Color-signature + exact bbox, never estimated centers** — COVER-badge verification was convincing only via identical pixel counts.
- **Bounded attempts + pivot** — after scroll/OTP misses, switched to documented recoveries (digit-by-digit OTP, inner-form scroll targeting) rather than infinite retries.
- **Correct-join DB verification** — caught and corrected the `user_id` vs `id` join.
- **CDP console capture** for the DEV-bypass activation evidence.
