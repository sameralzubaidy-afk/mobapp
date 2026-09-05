# QA Task 32 Combined — Ledger (in-progress)

## Part 1 — ADM Final Closure (QA Task 31-M Round 6)

### Batch A — E02/E05 (fresh-signup fixture) — ✅ PASS both
- E05 mobile leg: fresh Alice `b8415a56` "R6 Waitlist Parent" (qa.alice.17886272663069101@) ZIP 90210 → "We're Coming Soon" → Join Waitlist → Waitlist Confirmed → assigned fallback **Buffalo**. DB: zip_waitlist row `6390e6d4` (90210, pending, Buffalo). Ev: MOBILE-E05-waitlist-confirmed-90210.png, MOBILE-E05-fresh-user-home-buffalo-node.png
- E05 admin leg (/waitlist): title+subtitle ✓, cards Total 10/Pending 10/Notified 0/Joined 0 ✓, table ✓, email-substring search=1 fresh row ✓, ZIP search=1 ✓, status filters Pending=10/Notified=empty/Joined=empty ✓, empty-state msg + Page 1 of 1 ✓, combine ✓. **FINDING MOD: User column always "Unknown user"** — API `/api/admin/waitlist` selects `profiles.display_name` (nonexistent; actual col `name`) → every row falls back. Ev: ADMIN-E05-*.png
- E02 admin legs: /nodes **Add** "QA R6 Node Chicago" ZIP 60601 (auto Chicago/IL/41.8858,-87.6181) radius 15 active → DB `152b57ae`; **Edit** → "QA R6 Chicago Edited" radius 20 → DB + UI reload. Ev: ADMIN-E02-*.png
- E02 mobile leg: fresh Charlie `76af5475` "R6 E02 Parent" (qa.charlie.17886279236571281@) ZIP 60601 → **direct profile creation, NO waitlist** → node chip "QA R6 Chicago Edited". DB: node_id 152b57ae, zip 60601, 0 waitlist rows. Ev: MOBILE-E02-profile-created-no-waitlist-60601.png, MOBILE-E02-fresh-user-resolved-to-new-node-60601.png
- Residue (Batch A): fresh users Alice/Charlie + Bob (`3f22269f`, incomplete profile) remain (throwaway qa.*). Node 152b57ae ACTIVE (deactivate at cleanup). Waitlist row 6390e6d4 remains (no UI delete; flag residue).

### Batch B — C09/X05 — ✅ PASS both (admin + mobile legs)
- C09: test-buyer pending item `5cde6ca9` "My Own Item" $10 → /listings targeted search (seller test-buyer@ + Pending) → row → 📌 Listing Details modal → ✍️ Request Edits → "Decision Note (required for Request Edits)" → confirm "Send this listing back to seller for edits?" → item → **needs_edits**, rejection_reason "QA R6 C09:...". DB: status needs_edits, edited_since_rejection false. (No admin_listing_actions audit row for this action — noted, low.) Mobile seller leg (test-buyer): `listing-safety/5cde6ca9` → ListingSafetyReview "This listing needs edits before it can be approved." + NEEDS EDITS + "Admin's Edit Request" with exact reason (AX-verified). Ev: ADMIN-C09-*.png, MOBILE-C09-seller-needs-edits-review.png
- X05: r41-moderation flagged test-seller `0dca235c` (user_report) → Action Center "1 flagged listing pending review" → expand → **Approve** → toast "Approved QA Canned Cancelled-Trade Item." → card cleared. DB: item → **available**, approved_by 1a546991, flagged_at null. Moderation queue no longer lists it. Mobile buyer leg (test-buyer): `listing/0dca235c` → full ItemDetail + **Add + Request to Buy** (buyer-visible). **LOW: approve left 1 `item_safety_flags` row open** (clean via r41 reset). Note: Action Center row showed "$0.20" for a $20 item (display/format suspicion — verify later). Ev: ADMIN-X05-*.png, MOBILE-X05-approved-item-buyer-visible.png

### Batch C — G04 policy publish — ✅ PASS (admin); mobile re-prompt NOT auto-triggered (documented)
- Admin: Liability tab → "+ Create New Version" → disposable draft "QA R6 Disposable Liability" v9.9.8 (`10e2c3e6`) → **Publish** confirm EXACT "Are you sure you want to publish this policy? It will make it the active version for all users." → disposable becomes Active (v9.9.8), real "Kids P2P Liability Disclaimer 3" `4f41639e` → **archived**.
- DT109 restore: "Make Active" on archived real → confirm "Restore this version as the active policy? It will replace the currently active version." → real back to Active (published), disposable → **archived** (Delete is draft-only; disposable can't be deleted → archived residue flagged).
- Mobile leg: published disposable liability did **NOT auto re-prompt test-buyer on Home open** (session 490 SP on Diag Test Node = test-buyer verified). Re-prompt cross-ref is J05-specific (not reproduced here; documented). Blast contained (only test-buyer opened app during live window).
- Residue: archived "QA R6 Disposable Liability" v9.9.8 (no UI delete on archived; flag dev).
- Ev: ADMIN-G04-*.png

### Batch G — X07 failed-payout retry — ✅ PASS
- qa:failed-payout stage → row `db9bc05b` ($15, trade fe3924ee, failed) → Action Center Failed Payouts "1 failed payout needing retry" → **Retry** confirm "Retry this payout? This will attempt to reprocess the failed payout." → toast "Payout reset to pending for retry." → card cleared. DB: status **pending**, failure_reason null. Fixture reset (1 row deleted → 0 failed). Ev: ADMIN-X07-*.png

### Batch D — P01/P02/P03 badges — P01 ✅ · P02 ⚠️ PARTIAL (icon-upload defect) · P03 ✅
- P01 (list+toggle): /badges "Badge Management" list renders (13 rows, all Active). Toggle **SP Spender - Bronze** `510cd0b9` → inactive ("Badge deactivated successfully", DB is_active=false) → toggle active ("Badge activated successfully", back to Active). Reverted. Ev: ADMIN-P01-*.png
- P02 (edit + icon upload): Badge Editor opens for **50 Trades** `3ac79591` (name/desc/threshold/order/category-readonly/icon). Text edit (description → "QA R6 P02 temporary...") → "Badge updated successfully" + DB ✓ → reverted to "Completed 50 trades" ✓. **Icon upload FAILS — FINDING MED: upload of favicon.png → "Error uploading icon: StorageApiError: new row violates row-level security policy" (400, storage bucket `badge-icons` RLS blocks admin-client insert).** Editor surfaced the raw error. No badge-icons insert; no DB change. Ev: ADMIN-P02-*.png
- P03 (manual award): Manual Award modal → search test-buyer@ → found "Test Buyer" → select badge **50 Trades** + reason → "Badge awarded successfully". DB: user_badges row `baa7a2ee` (test-buyer, 3ac79591, 17:18:02). **Mobile leg (test-buyer): profile open fired "🎉 New Badge Earned! — 50 Trades / Completed 50 trades" celebration modal; My Badges count 11→12; AX `badge-showcase-50-trades` present in showcase.** Ev: ADMIN-P03-*.png, MOBILE-P03-*.png
- Residue (P03): the "50 Trades" badge award on test-buyer (user_badges baa7a2ee) — shared-persona residue, flag for dev cleanup (no UI revoke).

### Batch E — R03 publish FAQ/education — ⚠️ PARTIAL (education publish defect)
- FAQ leg ✅: draft FAQ `453c67ca` (status draft) + published FAQ `4cb779af` (status published) → mobile FAQ list (test-buyer Help → FAQ) shows "QA R6 R03 published FAQ..." and NOT the draft. Both FAQ fixtures deleted after (0 remain, DB-verified). Ev: ADMIN-R03-faq*.png, MOBILE-R03-faq-published-shown-draft-hidden.png
- Education leg ❌ via MED DEFECT: draft section "QA R6 R03 Education Section" `145edf55` created (DB draft) → **Publish FAILS: PGRST202 "Could not find the function public.publish_section(section_id) in the schema cache"** — DB function is `publish_section(p_section_id uuid)` (admin `.rpc()` body key `section_id` mismatch). Draft section stays draft (mobile Help correctly hides it). No UI delete on the section → residue flagged. Ev: ADMIN-R03-edu-section-published.png (shows error)

### Batch F — O04 ID request details — ✅ PASS
- /id-badges/76592772/details (rejected, test-seller): user, Status & Decision (Rejected), Submitted/Reviewed timestamps, Rejection Reason "QA Task 25 E03..." + **note "The ID screenshot was permanently deleted following the review decision to protect user privacy."** DB: screenshot_path null on all reviewed rows. Ev: ADMIN-O04-id-badge-request-details.png

## Part 1 cleanup (DB-verified)
- Node `152b57ae` deactivated (is_active=false, 17:26) — Charlie keeps assignment (member stays on inactive node). NOTE: status col still 'active' (minor).
- X05 item `0dca235c` r41-reset → available + safety-flag row cleared (0 open flags).
- QA R6 FAQ fixtures deleted (0 remain). 
- Badges: SP Spender Bronze back Active; 50 Trades description reverted.
- Real liability `4f41639e` restored Active (published).
- failed_payouts 0.
- **Non-reversible residue (flag dev):** archived disposable liability `10e2c3e6`, draft education section `145edf55`, P03 badge award baa7a2ee on test-buyer, fresh qa.* users (Alice b8415a56 / Bob 3f22269f incomplete / Charlie 76af5475) + waitlist row `6390e6d4`, C09 needs_edits item `5cde6ca9`.

## Part 2 (SUB first execution) — STATUS: NOT EXECUTED this session (scoped separately)
Per the round brief's explicit split permission, Part 2 (SUB's first-ever execution, 33 active cases + M03/M04 closure on a disposable real subscription) is a large independent body of work that must not be compressed into this ADM-closure session. It is scheduled as its own dedicated session(s). The M03/M04 ↔ SUB fixture synergy is identified: build ONE disposable real subscription (Stripe test-mode lifecycle) in the SUB session and apply it to SUB's subscription-lifecycle cases AND to ADM M03/M04 (extend/cancel/reactivate → mobile Manage Kids Club+ reflection). Scope (from qa-task31b baseline): A05, D05, F01/F03–F08, G01/G04–G11, H01–H04/H06/H07, I06, K02, M01/M06/M07, N03–N06 + M03/M04 (ADM). See `Part2-SUB/scope-note.md`.
