# Ledger — `qa-trd-final-wrapup-2026-09-12`

**Run:** TRD final wrap-up (Priority 1 + partial Priority 2) · **Date:** 2026-09-12 · **HEAD:** `9d623c4c` (no repo writes)
**Devices:** Android `Medium_Phone_API_36.1` (`emulator-5554`) · admin portal `:3001` (page `d8234aeb-…`, active) · Supabase staging `drntwgporzabmxdqykrp` (read-only).

**Call tally (manual, R71-fallback — the session transcript is not mineable for this run):** ≈**210** tool executions (device + admin + DB + reads/terminal) for **13 verdict-class items** ⇒ ≈**16 blended / verdict**, of which the genuinely device-side portion is ≈**120 / 13 ≈ 9**. Desk work (recon, guide reads, source reads, the N1 investigation, the tracker/report writes) accounts for the remainder and is counted separately here so the ratio is comparable to prior rounds.

---

## Verdict-class items (13)

| # | item | verdict |
|---|---|---|
| 1 | `TRD-TC-O1-C06` single listing → mapped tax category | ✅ PASS (Android) |
| 2 | `TRD-TC-O1-C07` bulk listing → mapped tax category | 🟡 BLOCKED (fixture + emulator media) |
| 3 | Books `category_tax_mapping` flip (admin) | ✅ PASS |
| 4 | `TRD-TC-O1-C15` mapping change affects new listings | ✅ PASS (7/7 steps) |
| 5 | Books mapping **restore** + DB verify | ✅ PASS |
| 6 | `TRD-TC-Q20` Hide semantics (re-report → Hide) | ✅ PASS |
| 7 | `TRD-TC-Q19` Keep + reporter-notification leg | 🔴 FAIL (defect N1) |
| 8 | `TRD-TC-Q01` review prompt (Android) | ✅ PASS |
| 9 | `TRD-TC-Q04` anonymous review (Android) | ✅ PASS |
| 10 | `TRD-TC-Q05` skip review (Android) | ✅ PASS |
| 11 | `TRD-TC-Q06` mutual review status (Android, both branches) | ✅ PASS |
| 12 | `TRD-TC-Q15` flag a review (Android) | ✅ PASS |
| 13 | `TRD-TC-Q17` cannot flag own / no public menu (Android) | ✅ PASS |

Incidental (not counted): Q08/Q09 Android re-confirm; FIX-Task-21 items 2 + 17 re-verified on the fresh Android bundle; Q02 behaviour observation.

---

## Ordered trace (condensed)

**Recon (desk).** R29 busy check (`pgrep expo start` → 8081 **and** 8082; `xcrun simctl list devices booted` → iPhone 17 Pro Max (not driven); `adb devices` → emulator-5554; no maestro/run-suite). Read the QA playbook + `/memories/repo/qa-test-agent.md` + the prior round's report (`qa-fix20-verify-groupsq-taxlegs-2026-09-12/report.md`) → established that today's earlier round was **iOS-only**, so Group Q's Android legs were genuinely owed. Read the TRD guide's O-1 index + C06/C07/C15 bodies and the Q19/Q20 bodies; read `keep/route.ts` + `hide/route.ts`; read `qaPersonas.ts`, `ItemCreateScreen` dev fixtures, `BulkListingCreateScreen` dev fixtures + `BulkPublishBar`/`BulkPublishConfirmSheet`, `ReviewCard` + `SellerProfileScreen`/`ProfileScreen` `ReviewCard` usages, and the tax `category-mapping/page.tsx` selectors.

**DB recon (read-only).** Books mapping = `tax_exempt_goods` (10 mappings, 4 tax categories); test-seller `14be337c…` with 278 items; category display order Books(1)→Games(2)→Toys(3)… ⇒ `dev-set-category` always picks **Books**.

**Android device work.**
1. `qa-login-as?persona=test-seller` → **raced** the following `create-item` deep link (the login handler's navigation reset landed *after* the create navigation and returned the app to Home). Re-fired `create-item`; app settled on "New Item".
2. `dev-fill-item` (1 photo, title, $20, new) → **real `CategorySelectModal`** (AX-drivable on Android) → **Games** → `publish-button` → success modal → DB: `591053d3` = `general_tangible_goods` (**C06 ✅**) → "Go To My Items" → My Listings PENDING.
3. `bulk-create` → intro → `dev-add-test-photos` (5/30) → `bulk-reset-grouping` (5 items) → `dev-set-item-categories` + `dev-fill-bulk-items` → `dev-skip-to-review` → review step → `bulk-publish-button` → confirm sheet → Submit → **"Missing bulk session or draft session."** (no items written).
4. Real-picker path: `bulk-image-picker-add-more` → source sheet → **Photo Library** → picker "**No photos yet**". Populated MediaStore from the host (`adb push` app assets → `/sdcard/Pictures/QA`; `content call … scan_file`; verified **12** rows via `content query`) — the picker still did not surface them ⇒ **C07 registered BLOCKED** with the gap named.
5. `create-item` again (screen **retained** — Books/1 photo/title still set) → keyboard-dismiss → `dev-set-category` → **Books** → `publish-button` → DB: `c1b3cd63` = `tax_exempt_goods` (**C15 step 2–3 ✅**).
6. Admin (`run_playwright_code`, DOM `.click()`): `/tax/category-mapping` → Change Books → *General Tangible Goods* → Save → **"Mapping updated…"** → DB `general_tangible_goods` @21:35:04.543Z + `category_tax_mapping_changed` audit row (**flip ✅**).
7. `create-item` again → modal dismiss (BACK) → IME dismiss → `publish-button` → DB: `ba961cae` @21:35:55Z = **`general_tangible_goods`**; `c1b3cd63` unchanged (**C15 ✅**).
8. Admin restore: Books → *Tax Exempt Goods* → DB `tax_exempt_goods` @21:36:08.889Z, 10 mappings (**restore ✅**).
9. `qa-login-as?persona=test-seller-3` (+ a stray chat-header tap → Messages → Home → avatar) → own profile → swipe → **`review-menu-button`** on both review cards (no such element on the **public** SellerProfile ⇒ Q17) → **Report as Offensive** → confirm dialog → success **"Review reported. Thank you!"** → DB report `f19a333c`, `report_count 1` (**Q15 ✅**, Q20 setup).
10. Admin Hide (window.confirm overridden first): row → **"Hidden"**, queue stays **14**, DB `is_hidden=true`/`review_status='hidden'`/reports retained, `user_notifications` **`review_report_hidden`** written; reviewee's public profile **Reviews (2)→(1)** (**Q20 ✅**).
11. Admin Keep: POST → **200 `{"success":true}`**, DB unchanged, row stays. **Investigated**: response body ≠ `keep/route.ts`; dev-server log shows **no POST + no compiled `keep` route**; no catch-all, no SW/MSW. **Restarted the admin dev server** and re-drove → **identical result** ⇒ recorded as defect **N1** (Q19 🔴) and stopped (execution-only boundary).
12. **R79-1 cold reload** (stale-bundle signal: pre-fix `char-count` copy) → terminate + launch → Dev Launcher → `10.0.2.2:8081` → Home as test-seller-3; re-took every Q verdict on the fresh bundle (discriminating check: title now *"Review Test Buyer"*).
13. Trade `4d50a44e` (seller-side free slot): Q06 seller branch + Q01 CTA → SubmitReview (**item 2 + item 17 verified**) → **Skip for Now** → immediate return, CTA present, DB unchanged (**Q05 ✅**).
14. `qa-login-as?persona=test-buyer` → trade `47bdab0a` (buyer-side free slot): Q06 both-unreviewed branch → CTA → 5★ + **Post anonymously** → Submit → **"Gateway Timeout"** (N2) → dismiss → Submit again → DB `15363fc3`, `rating=5`, `is_anonymous=true` (**Q04 ✅**).
15. `qa-logout` → Landing.

**Writes:** `e2e-test-results/qa-trd-final-wrapup-2026-09-12/` only (report, ledger, **41** screenshots — `AND-00` … `AND-40`) + the tracker note. No app/repo code, no config left changed, no `git` writes.

**Environment left behind:** Android app **logged out** (Landing); admin portal **restarted and running** on `:3001` at `/reviews`; Metro `:8081` + `:8082` both still running (untouched); Books mapping **restored** (`tax_exempt_goods`, DB-verified); iOS Simulator untouched.

**Residue:** review **`44f5662f` left hidden** (restore blocked by N1); 3 new pending listings under test-seller (`591053d3` Games, `c1b3cd63` Books, `ba961cae` Books); 1 new review `15363fc3` (anon, 5★) on trade `47bdab0a`; 1 `review_reports` row `f19a333c`; 1 unread `review_report_hidden` notification for test-seller-3.
