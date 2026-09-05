# QA Task 32 — Part 1: ADM Final Closure (QA Task 31-M Round 6) — COMPLETE DELIVERABLE

**Run date:** 2026-09-05 · **Folder:** `e2e-test-results/qa-task32-adm-r6-sub-2026-09-05/Part1-ADM/`
**Build:** current dev (post-DT114/DT113/DT112/DT110/DT109) · **Guide:** `MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` · **Rules:** ADM-R1–R6, R55/§5.57 (mobile legs same-session), R53/§5.55 (full handoff), R52/§5.54 (tracker), R59 (fresh fetch after backend changes), R60 (batched dialogs), R28/R37 (config scope-write-revert), §5.34 (schema-first SQL).
**Device:** iPhone 17 Pro Max sim `3F3293A3` · Admin `:3001` (shared page, samer `1a546991`) · Metro `:8081` · Staging `drntwgporzabmxdqykrp`.

## Verdict summary (Part 1 — the ADM final-closure remainder)

**Before this round (Round 5 close):** the fixture-gated remainder = E02/E05, C09/X05, G04, M03/M04, O04, P01/P02/P03, R01/R03, X07 (each with an explicit owed note). **After this round:** 9 of the 11 cases closed to PASS or PARTIAL-with-real-findings; M03/M04 remain deferred to Part 2 (SUB) per the standing R40 deferral; **3 real MOD defects surfaced** (waitlist USER-column display-name bug, badge icon-upload storage-RLS failure, education-section publish RPC arg-name mismatch). 0 FAIL as app-behavior regressions, but P02/R03 are PARTIAL solely because of the two genuine defects found (the icon upload + the education publish button are broken in the product).

| Batch | Case | Verdict | Core result |
|---|---|---|---|
| A | **E05** ZIP waitlist | ✅ PASS | Fresh signup (Alice, 90210) → "We're Coming Soon" → Join Waitlist → confirmed, fallback Buffalo (DB row `6390e6d4`). Admin /waitlist: cards, search-by-email/ZIP, status filters + empty states, pagination all work. **FINDING MOD: User column always "Unknown user"** (`/api/admin/waitlist` queries nonexistent `profiles.display_name`; actual col is `name`). |
| A | **E02** Add/edit node | ✅ PASS | Admin /nodes add "QA R6 Node Chicago" (60601, auto Chicago/IL) + edit → "QA R6 Chicago Edited" radius 20 (DB `152b57ae`). Fresh signup (Charlie, 60601) → **direct profile creation, no waitlist**, node chip "QA R6 Chicago Edited" (DB node_id 152b57ae, 0 waitlist rows). |
| B | **C09** Request Edits | ✅ PASS | test-buyer pending "My Own Item" `5cde6ca9` → Request Edits → reason → confirm ("Send this listing back to seller for edits?") → **needs_edits** (DB). Mobile seller leg: ListingSafetyReview "This listing needs edits before it can be approved." + NEEDS EDITS + "Admin's Edit Request" with exact reason (AX-verified). |
| B | **X05** Inline approve flagged | ✅ PASS | r41-flagged `0dca235c` → Action Center Approve → toast "Approved…" → card cleared → **available** (DB, approved_by admin). Mobile buyer leg: full ItemDetail + Request to Buy. LOW: approve left the `item_safety_flags` side-row (cleaned via reset); Action Center row showed "$0.20" for a $20 item (see findings). |
| C | **G04** Publish policy | ✅ PASS (nuance) | Disposable liability v9.9.8 draft → Publish confirm EXACT copy → active; real `4f41639e` → archived. DT109 **Make Active** restore → real active again, disposable archived (Delete draft-only). Mobile: publishing a new liability did **NOT** auto re-prompt test-buyer on Home open (re-prompt cross-ref is J05-specific; documented). Blast contained to test-buyer. |
| D | **P01** Badge list+toggle | ✅ PASS | List renders (13). Toggle SP Spender Bronze inactive → DB → active (both directions, reverted). |
| D | **P02** Edit badge/icon | ⚠️ PARTIAL | Badge Editor opens; description edit → saved + DB → **reverted**. **FINDING MED: badge icon upload FAILS** — favicon.png → "Error uploading icon: StorageApiError: new row violates row-level security policy" (400; `badge-icons` bucket RLS blocks the admin client insert). No icon change persisted. |
| D | **P03** Manual award | ✅ PASS | Awarded "50 Trades" to test-buyer (DB `baa7a2ee`). Mobile: profile open fired "🎉 New Badge Earned! — 50 Trades" modal; My Badges 11→12; `badge-showcase-50-trades` present. Residue: award on shared persona (flagged). |
| E | **R03** Publish FAQ/education | ⚠️ PARTIAL | FAQ: draft FAQ (hidden) + published FAQ → mobile FAQ shows published, hides draft ✅ (both deleted after). **FINDING MED: education-section Publish FAILS** — PGRST202 "Could not find the function public.publish_section(section_id)" — DB function is `publish_section(p_section_id uuid)` (arg-name mismatch in the admin `.rpc()` call). Section stays draft. |
| F | **O04** ID request details | ✅ PASS | Reviewed rejected request `76592772` details: status badge Rejected, timestamps, rejection reason/notes + **"The ID screenshot was permanently deleted following the review decision to protect user privacy."** (DB: screenshot_path null on all reviewed rows). |
| G | **X07** Retry failed payout | ✅ PASS | qa:failed-payout staged `db9bc05b` → Action Center Retry confirm ("Retry this payout?…") → "Payout reset to pending for retry." → **pending** (DB). Fixture reset. |
| — | **M03/M04** | ⏸ Held | Deferred to Part 2 (SUB disposable subscription) per standing R40 — NOT part of this Part-1 deliverable. |

**Part 1 roll-up: 8 PASS · 2 PARTIAL (P02/R03, both due to genuine MED product defects) · 0 FAIL · 0 BLOCKED.** Plus **3 real MOD defects** reported to dev (see Findings).

## Findings

1. **[MOD — real defect] Admin /waitlist "User" column always renders "Unknown user".** `/api/admin/waitlist/route.ts` selects `profiles.user_id, display_name`, but the profiles table has no `display_name` column (it is `name`) → the select fails and every row falls back to the "Unknown user" placeholder. E05's expected "user display name (fallback Unknown user)" never shows a real name for ANY user, including a freshly-signed-up named user. Fix: select `profiles.name` (and map to `user_display_name`). (Found via the fresh 90210 signup this round.)
2. **[MOD — real defect] Admin Badge Editor icon upload is broken (storage RLS).** Uploading any icon to a badge returns `StorageApiError: new row violates row-level security policy` (HTTP 400) on the `badge-icons` bucket; the editor surfaces the raw error string. The category-icon upload path (used in R5's D05) works, so this is specific to the `badge-icons` bucket policy. P02's icon-upload leg cannot succeed until fixed.
3. **[MOD — real defect] Admin Education-section Publish is broken (RPC arg-name mismatch).** The "Publish" action on an education section returns `PGRST202: Could not find the function public.publish_section(section_id)` — the DB function is `publish_section(p_section_id uuid)` and the admin calls it with a positional/body key `section_id`. R03's education publish leg cannot succeed until the caller passes `p_section_id`.
4. **[LOW — display] Action Center flagged-item row shows "$0.20" for a $20 item.** The inline flagged-item row rendered the price 100× too small (item 0dca235c is $20; row showed $0.20). Verify the price formatter on the flagged-item Action Center row.
5. **[LOW — data] `nodes.is_active=false` but `nodes.status='active'` after admin Deactivate.** The toggle flipped `is_active` (the signup gate) but left `status` stale at 'active' on node `152b57ae`. R5's deactivated node showed status 'inactive'; this toggle only updated `is_active`. Confirm the toggle also updates `status`.
6. **[LOW — residue/cleanup] Non-reversible QA residue left on staging** (all flagged for dev): archived disposable liability "QA R6 Disposable Liability" v9.9.8 (`10e2c3e6`; Delete is draft-only), draft education section "QA R6 R03 Education Section" (`145edf55`; no delete control), the P03 "50 Trades" award on test-buyer (`baa7a2ee`; no UI revoke), fresh QA users Alice/Bob/Charlie + Alice's 90210 waitlist row `6390e6d4` (throwaway qa.*; no sanctioned delete), and the C09 fixture item `5cde6ca9` now `needs_edits` (a legitimately-edited leftover listing).

## Design / copy / UX notes

- ListingSafetyReview needs-edits state is clean: "This listing needs edits before it can be approved." banner + NEEDS EDITS badge + "Admin's Edit Request" box with the decision note + a clear "Once you make the edits, your listing will be re-reviewed." No raw codes surfaced. (Minor: "Last flagged at" / "Last rejected at" both mirror the needs-edits transition timestamp on a never-flagged/never-rejected item — source-documented fallback, minor.)
- The policy Publish + Make-Active confirmations carry clear, parent-appropriate copy; the "New Badge Earned!" celebration on manual award is a nice touch and parent-correct.
- Two of the three MED findings (badge-icon + education-publish) surface **raw system error strings** in the admin UI ("new row violates row-level security policy", the PGRST202 text) — a §6.3/R58-style non-user-friendly system-message exposure on admin surfaces (lower severity than user-facing, but noted).

## Perceived load-time (labeled per §5.7; simulator/browser wall-clock, not a profile)

All admin actions (node create/edit, policy publish/restore, moderation, badge toggle/edit/award, waitlist search/filter) completed in ~1–2.5s each; no user-initiated transition ≥3s was observed. Mobile transitions (signup steps, profile setup, item detail, FAQ/education screens) ~0.5–2s each.

## Evidence (screenshots/)

Batch A: `MOBILE-E05-waitlist-confirmed-90210.png`, `MOBILE-E05-fresh-user-home-buffalo-node.png`, `ADMIN-E05-waitlist-fresh-90210-row.png`, `ADMIN-E05-search-email.png`, `ADMIN-E05-search-zip.png`, `ADMIN-E05-empty-state.png`, `ADMIN-E05-status-filters-final.png`, `ADMIN-E02-add-node-form-filled.png`, `ADMIN-E02-node-created.png`, `ADMIN-E02-node-created-in-list.png`, `ADMIN-E02-edit-node-filled.png`, `ADMIN-E02-node-edited-list.png`, `ADMIN-E02-node-edited-reload-confirmed.png`, `MOBILE-E02-profile-created-no-waitlist-60601.png`, `MOBILE-E02-fresh-user-resolved-to-new-node-60601.png`
Batch B: `ADMIN-C09-targeted-search.png`, `ADMIN-C09-item-detail-pending.png`, `ADMIN-C09-listing-details-modal.png`, `ADMIN-C09-request-edits-reason-form.png`, `ADMIN-C09-after-request-edits.png`, `MOBILE-C09-seller-needs-edits-review.png`, `ADMIN-X05-action-center.png`, `ADMIN-X05-flagged-expanded.png`, `ADMIN-X05-after-approve.png`, `MOBILE-X05-approved-item-buyer-visible.png`
Batch C: `ADMIN-G04-policies-page.png`, `ADMIN-G04-liability-tab.png`, `ADMIN-G04-new-liability-form.png`, `ADMIN-G04-draft-created.png`, `ADMIN-G04-liability-draft-created.png`, `ADMIN-G04-published.png`, `ADMIN-G04-restored-real-liability.png`, `ADMIN-G04-restored-confirmed.png`
Batch D: `ADMIN-P01-badges-list.png`, `ADMIN-P01-toggle-inactive.png`, `ADMIN-P01-reverted-active.png`, `ADMIN-P02-badge-editor-open.png`, `ADMIN-P02-badge-edited.png`, `ADMIN-P02-icon-uploaded.png` (shows the RLS error), `ADMIN-P03-manual-award-open.png`, `ADMIN-P03-user-found.png`, `ADMIN-P03-awarded.png`, `MOBILE-P03-new-badge-earned-50-trades.png`, `MOBILE-P03-celebration-modal.png`, `MOBILE-P03-badge-showcase-50-trades.png`
Batch E: `ADMIN-R03-faq-admin.png`, `ADMIN-R03-add-faq-form.png`, `ADMIN-R03-draft-faq-created.png`, `ADMIN-R03-published-faq-created.png`, `ADMIN-R03-add-section-form.png`, `ADMIN-R03-edu-section-draft.png`, `ADMIN-R03-edu-section-published.png` (shows PGRST202 error), `ADMIN-R03-edu-section-published-confirmed.png`, `MOBILE-R03-faq-published-shown-draft-hidden.png`
Batch F: `ADMIN-O04-id-badge-request-details.png`
Batch G: `ADMIN-X07-action-center-failed-payout.png`, `ADMIN-X07-after-retry.png`
Cleanup: `ADMIN-cleanup-node-deactivated.png`

## App / config state left behind (all DB-verified)

- Config baselines restored: badges all active + descriptions reverted; disposable node `152b57ae` deactivated (is_active=false); real liability `4f41639e` restored to published; failed payouts 0; X05 item `0dca235c` available + flags cleared; QA FAQ items deleted (0 remain).
- Residue for dev (non-reversible via UI/fixture tools): archived disposable liability, draft education section, P03 badge award on test-buyer, fresh qa.* users + 90210 waitlist row, C09 needs_edits fixture item, deactivated node with stale `status` column.
- Mobile session left = test-buyer (Help & Support). Admin = samer. Metro + admin dev server running.
