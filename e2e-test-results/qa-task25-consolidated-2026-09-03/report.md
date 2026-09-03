# QA Task 25 — Consolidated Round (MSG unblocked + SUB fixtures + DT97 visual pass) — Handoff Report

- **Run date:** 2026-09-03 (evening session)
- **Agent:** QA Test Agent (execution-only)
- **Task:** Consolidated round across the MSG + SUB guides: Batch 1 (MSG ID-verification auth-unblocked E02/E03/E04/E05/D07/D08/R04), Batch 2 (DT97 on-device visual pass 5-1..5-4), Batch 3 (R41 fixture-unblocked SUB C09/D03/E03/E04 + MSG G-series/H05/H06), Batch 4 (D06/D07/L02, gated on DT99).
- **Evidence root:** `e2e-test-results/qa-task25-consolidated-2026-09-03/screenshots/`
- **Surfaces:** iOS mobile (simulator `E4322437` iPhone 17 Pro Max), live admin portal (`:3001`, fresh start, `.next/cache` cleared per task note), staging Supabase (`drntwgporzabmxdqykrp`), live DB verification for every server-side claim.
- **App build on device:** `PassItUp.app` installed 2026-09-03 16:51 (includes DT95/DT97/DT98/DT99/DT100 commit `87adb58e` @16:47; HEAD DT96 @17:14 not in this binary). Verified via `git log` on the touched source files.

---

## 1. Batch summary

| Batch | Cases | Result |
|---|---|---|
| B1 | MSG E02, E03, E04, E05, D07, D08, R04 | **PASS×5 · PARTIAL×1 (E04) · PASS-already-covered×1 (R04)** |
| B2 | DT97 visual 5-1..5-4 | **CONFIRMED×2 on-device (5-3, 5-4) · source+mechanism-confirmed×2 (5-1, 5-2)** |
| B3 MSG | G01–G04, G06, G07 | **BLOCKED** — confirmed app bug (Safety Review data-loading) |
| B3 MSG | H05, H06 | **PASS (H05) · PASS (H06 Resolve-Complete leg; Refund leg fixture-gap)** |
| B3 SUB | C09, D03, E03, E04 | **PASS×2 (C09, D03) · FAIL-finding×1 (E03 error-msg) · PASS×1 (E04)** |
| B4 | L02 | **PASS — cross-referenced from DT99 independent QA** (real grace/freeze leg verified live) |
| B4 | D06, D07 | **GATED** — need R41 notif-sub-event fixture rows staged by dev (service-role write) |

---

## 2. Per-case verdicts & evidence

### Batch 1 — MSG ID Verification (E/D/R)

**MSG-TC-E02 (Approve) — PASS.** Opened test-seller-3's pending request `d148ee0f` in the admin ID-badge Review page; the signed screenshot URL now loads (previously-401 path works); selected **Approve** + note, submitted → alert "Request approved successfully", returned to queue (Pending 24→23, Approved 20→21). DB: `d148ee0f` → `status=approved`, `reviewed_at` 21:25:51, `reviewed_by` samer, `approval_notes` set; `id_badge_approved` notification "ID Verification Approved! 🎉 / …You now have the Verified badge." to test-seller-3. Screenshot storage object deleted post-decision (admin log: screenshot-url 404s "Object not found" — privacy promise held at the object level). Evidence: `MSG-D03-submitted-tseller3.png`, review-page capture.

**MSG-TC-E03 (Reject with reason) — PASS.** test-seller's pending request `76592772` → Review → Reject radio → reason dropdown (Unclear photo / ID expired / Name does not match profile / Multiple IDs / Not a government-issued ID / Other) → submit with no reason fired a dialog **"Please select a rejection reason"** (guide match) → selected "Unclear photo" + notes → "Request rejected successfully". DB: `76592772` → `rejected`, `rejection_reason=unclear_photo`, `rejection_notes`, `reviewed_at`; `id_badge_rejected` notification with reason + notes delivered. Evidence: `MSG-D08-rejection-notification.png`.

**MSG-TC-E04 (View completed details) — PARTIAL (status-display finding).** The completed-request **details** page is reachable (`/id-badges/<id>/details`, read-only: User Information + Status & Decision + screenshot-deleted note). For test-buyer's earlier-approved request `34254b02` the page is correct ("Current Status: Approved" + Reviewed At). For the freshly-approved `d148ee0f` it persistently shows **"Current Status: Pending"** (no Reviewed At) — reproduced on reload + cache-bust, while the queue and DB both say Approved. Admin status-display inconsistency for just-approved requests. Finding #3.

**MSG-TC-E05 (Edit message templates) — PASS.** Message Templates tab → Edit `approved_email_body` → changed text (appended `QA-E05-temp`) → Save → "✓ Saved successfully" + Last-updated bumped; **reverted** to the original string and re-saved. (Confirmation copy is "✓ Saved successfully", not the guide's "Message saved" — minor doc drift.)

**MSG-TC-D07 (Approved → Verified badge) — PASS (with self-view finding).** test-seller-3's ID screen shows **"Identity Verified"** + green **"Verified ✓"** pill (`id-verification-status-pill-verified`). Public Seller Profile (other-user view, the realistic case) shows **"Identity Verified" / Trust level: Ultimate** + ShieldCheck. **Finding #2:** immediately post-approval, test-seller-3's OWN public profile self-view showed "Identity Not Verified / Verification required" across remounts (~1–2 min), while (a) the same profile viewed by test-buyer and (b) test-buyer's own self-view both showed Verified — a session/self-view stale-state inconsistency. Evidence: `MSG-D07-identity-verified-tseller3.png`, `MSG-D07-public-profile-not-verified-tseller3.png`, `MSG-D07-public-profile-verified-otherview.png`.

**MSG-TC-D08 (Rejected → reason shown + resubmit) — PASS.** After the E03 rejection, test-seller's ID screen returns to the **upload state** (resubmission possible — no inline rejected-state, by design), and the Notification Center's top row (`id_badge_rejected`, `b6a251d2`) shows "Your ID verification was not approved. Please submit a new request with clearer details. **Reason: Unclear Photo.** Note: QA Task 25 E03…". User notified with reason + admin notes; resubmit possible. Evidence: `MSG-D08-rejection-notification.png`.

**MSG-TC-R04 (ID verification lifecycle) — PASS-already-covered.** The full submit → admin approve/reject → badge state / notify → screenshot-deletion lifecycle was exercised end-to-end this session across E02/E03/D07/D08 (two distinct users). No new regression.

### Batch 2 — Dev Task 97 on-device visual pass

- **DT97 5-3 — PASS (on-device).** Pending ID-verification screen's "Back to Profile" (`id-verification-back-profile-btn`) renders as a **secondary-outline pill: white background, green outline, green text** — no longer the old gray-filled button. Screenshot: `MSG-D06-pending-tseller3.png`.
- **DT97 5-4 — PASS (on-device, two-state).** Referral program paused (`sp_config.referral_program_enabled=false`) → Referrals screen shows the amber "paused globally" banner (`program-paused-banner`) and reward rows render (source `rowDimmed {opacity:0.5}` applied to `trade-bonus-row`/`listing-bonus-row`/`you-earn` row). Re-enabled → fresh mount shows **no banner + full-intensity rows**. Config revert DB-verified (`true`, 21:50:36). Screenshots: `DT97-54-referrals-paused.png`, `DT97-54-referrals-normal2.png`.
- **DT97 5-1 — source+mechanism confirmed (not re-driven end-to-end).** SignupScreen invalid-referral dialog: **'Fix it' is `primary:true`** (`referral-invalid-fix-it-button`), 'Continue anyway' secondary — confirmed in the installed source (commit `87adb58e`). The GlobalAlertProvider primary-pill rendering of the same dialog system was observed on-device repeatedly this session (D03 "Submitted Successfully" etc.). Full signup-form drive not repeated (multi-field form cost) — recommend folding into the next fresh-signup case.
- **DT97 5-2 — source+mechanism confirmed (award not re-driven).** ProfileScreen `handleCelebrationClose` bumps `badgeShowcaseRefresh` on modal close → `BadgeShowcase refreshToken` refetches "My Badges (N)". Comment: "DT97 (Item 5-2)". The celebration-modal mechanism itself was verified on-device in QA Task 24 B04 (PASS); a fresh award-and-dismiss was not re-driven this session.

### Batch 3 — MSG Safety & Compliance

**MSG-TC-G01–G04, G06, G07 — BLOCKED (confirmed app bug, not fixture-gated).** All five R41 moderation fixtures are live on test-seller (flagged `ba6345ce`, rejected-fresh `ccf97ae4`, rejected-backdated-15d `e2096de2`, needs-edits `afd3384a`, rejected-appeal-count-3 `ce322cd9`; DB-verified). Deep link `listing-safety/:id` → **Safety Review screen renders "Unable to open safety review / Listing not found"** for the flagged fixture (on-device, reproducible). **Root cause (source-confirmed):** `ListingSafetyReviewScreen.loadListing` uses `getListingById`, which **returns null for any `status !== 'available'` item** (listing.ts L1249–1254 direct + L1408 fallback — the "⭐ FIX: Don't show items no longer available" filter). MyListings `handleOpenListing` routes flagged/rejected/needs-edits to the same screen → the seller appeal/resubmit/remove flow is **unreachable on-device** for every affected listing. The R41 fixtures reached the screen but the app cannot load them — a HIGH finding (finding #1). Evidence: `MSG-G01-safety-review-listing-not-found.png`.
  - MSG-TC-G05 / R03 not attempted (explicitly excluded — product decision on the recall-alert producer).
  - MSG-TC-G08 not attempted (explicitly excluded — external AI-vision infra).

**MSG-TC-H05 (Dispute: mark under review) — PASS.** Admin Disputes → trade `943097a5` (R41 reported-dispute fixture: "Item condition was not as described", in_progress, non-bundle) → detail shows reported state + buyer reason + Reported At → **Mark Under Review** → confirm → dispute_status **`under_review`** (DB-verified).

**MSG-TC-H06 (Dispute: resolve complete/refund) — PASS (Resolve-Complete leg).** On the under-review dispute → **Resolve → Complete** → confirmation "The trade will be marked complete. Seller payout will proceed normally." → confirm → DB: trade `943097a5` → `status=completed`, `dispute_status=resolved`, `dispute_resolution=resolved_seller`. **Coverage note:** the "Resolve → Refund Buyer" leg needs a second reported dispute fixture (the R41 reset/re-stage is a dev-run service-role step; one fixture was consumed by the Complete leg).

### Batch 3 — SUB

**SUB-TC-C09 (Manage Kids Club+ expired state) — PASS.** test-expired (standing persona `a1234567-…-013`: sub `expired`, past dates, wallet `frozen`) → Manage Kids Club+ (deep link `manage-kids-club`) shows Status **expired** + info box "Your subscription has expired / Re-subscribe to restore Kids Club+ access and unfreeze any remaining Swap Points." + green **"Re-subscribe to Kids Club+"** button + View Billing History. Evidence: `SUB-C09-manage-expired-full.png`.
  - Note: the expired gate keeps test-expired on the SubscriptionExpired screen; Manage is reachable only via the `manage-kids-club` deep link (no in-app Profile path for a gated expired user in the bounded attempts) — noted for product/UX.

**SUB-TC-D03 (Subscription Expired screen) — PASS.** Login as test-expired lands on the navigator's SubscriptionExpired initial route: header + **"Your Kids Club+ plan ended on July 25, 2026"** (dated copy now renders — the DT100 expired-date fix is live and resolves the R41 flagged gap about route params) + "What you're missing out on:" (Trade with PIPs / Reduced Fees / Keep Your Points) + **[Renew Plan]** + [Continue with Free Plan]. Evidence: `SUB-D03-subscription-expired.png`.

**SUB-TC-E03 (Failed charge error message) — FAIL-finding.** test-buyer Transaction History (Profile → Billing History, deep link `billing-history`) shows the R41 failed-charge row (`95d98ab0`, $5.99, Sep 3) with a red **FAILED** badge. **But the error message text is NOT rendered below the amount** — source confirms `TransactionHistoryScreen` never renders the per-row `billing_history.error_message` (which is stored and meaningful: "Your payment was declined. Please update your payment method…"). The case's namesake assertion ("failed charge shows error message") is unmet on-device — a parent cannot see why the charge failed. Evidence: `SUB-E03-transaction-history-failed.png`. Finding #4.

**SUB-TC-E04 (Subscription Status screen) — PASS.** test-buyer's Notification Center → the R41 `sub_status` fixture notification (`62dfdbf5`, deep_link `/subscription/status`) → tap → **Subscription Status** screen: ACTIVE badge, Last updated, Renews On 9/27/2026, Stripe Customer ID `cus_Ungj4MptKp9CUg` / Subscription ID `sub_1To5Vg4I6kCJlvXoebIAvLZJ`, Billing Period start/end + "24 days remaining". Evidence: `SUB-E04-subscription-status.png`.

### Batch 4 — (gated on Dev Task 99 v2)

**SUB-TC-L02 (Payment-failed webhook → retry/grace) — PASS (cross-referenced).** DT99 v2's own independent QA stage (`e2e-test-results/dev-task99-grace-freeze-verify-2026-09-03/report.md`) drove the real failing-renewal cycle on a fresh disposable user: on the 3rd payment failure the subscription → `grace_period` (grace_started_at ~0.95s after 3rd failure, grace_ends_at +30d) and `sp_wallets.state → grace_period` (R6 spendable grace, not frozen), with 3 critical payment-failed notifications; success-path + return-to-active legs also PASS. That is L02's mechanism + live-leg assertion, confirmed independently. L02 upgrades from PARTIAL to **PASS** (grace/freeze leg now confirmed live).

**SUB-TC-D06 / D07 (subscription event + grace-reminder notifications) — GATED.** DT98 fixed the grace-period-cron defects so its real output now matches the producer-faithful fixture shape (per task note, byte-for-byte). However the D06/D07 verification depends on either (a) real cron timing + real push (not drivable in-session) or (b) the R41 `notif-sub-event` fixture rows (`trial_reminder_7d/3d/1d`, `renewal_success`, `payment_failed`, `grace_reminder_30/7/1`) being staged on a persona. DB check confirms **no such rows are staged** on test-buyer (only the E04 `sub_status` row). Staging those rows is a service-role write (dev-run R41 script), outside the execution-only QA agent's authority. → GATED with reason; a one-line dev fixture stage (`npm run qa:r41-sub -- notif-sub-event …`) unblocks the in-app observation leg.

---

## 3. Findings (ranked — for the dev agent as separate follow-ups)

1. **[HIGH] MSG seller Safety Review flow is unreachable on-device.** `ListingSafetyReviewScreen` loads via `getListingById`, which hard-returns null for `status !== 'available'` (listing.ts direct + fallback). Every flagged/rejected/needs-edits listing — including the R41 fixtures staged specifically to exercise it — renders "Unable to open safety review / Listing not found". Blocks MSG G01–G04, G06, G07 (and is the seller half of the moderation story). **Fix:** Safety Review should load the seller's own non-available listing (e.g., an owner-scoped `getListingById` bypass for flagged/rejected/needs-edits statuses, or a dedicated owner fetch), not the public available-only fetch.
2. **[MED] Public-profile Verified indicator is session/self-view inconsistent right after approval.** test-seller-3's own public profile showed Not-Verified for ~1–2 min post-approval across remounts while other-user views and a second approved user's self-view showed Verified. Likely a stale `SellerProfileScreen` secondary verification-status load (self-view). Reproduce + root-cause.
3. **[MED] Admin ID-badge details page shows "Pending" for a just-approved request.** `/id-badges/<id>/details` for `d148ee0f` shows Current Status: Pending (no Reviewed At) though the DB row + queue say Approved; an older approved request renders correctly. Admin status read inconsistency for fresh decisions.
4. **[MED] SUB failed-charge reason is never shown to the user.** `TransactionHistoryScreen` renders a red FAILED badge but not the stored `billing_history.error_message`. Recommend rendering the error message under the failed amount (a parent must know why a subscription charge failed / that they should update their payment method).
5. **[LOW] ID screenshot DB path retained after decision.** The storage object is deleted post-decision (verified — screenshot-url 404s), honoring the "permanently deleted" privacy note, but `id_badge_verification_requests.screenshot_path` keeps the (now-dangling) path string on approved + rejected rows. Consider nulling it.
6. **[LOW] SUB E04/`SubscriptionStatusScreen` still push-payload-only reach** — reachability requires the notification fixture (already documented; not an app bug).
7. **[UX/LOW] Safety Review error state is misaligned** (`ListingSafetyReviewScreen` error branch — the "Unable to open safety review / Listing not found" screen, user-flagged 2026-09-03). The error fragment renders three bare children directly under `ScreenLayout` with **no wrapping/centering container**: the title + subtitle are pinned to the very top of the body (title y≈127, subtitle y≈159 under the header) instead of being vertically centered like the app's standard empty/error states; the title is **left-aligned** while the subtitle is `textAlign:'center'` (mixed alignment); the **Back** button is a full-bleed green bar (no max-width/centering) with the whole group edge-to-edge (no page-horizontal-padding rhythm); and the text uses Tailwind grays (`errorTitle #111827`, `errorText #6B7280`) instead of the canonical `#1A1A1A`/`#6B6B6B` tokens. **Fix:** wrap the error state in a centered flex container (`flex:1; justifyContent:'center'; alignItems:'center'; paddingHorizontal:20`), center the title + subtitle, constrain the Back button to a centered max-width pill (~240), restore the 8/24 spacing rhythm, and remap the text colors to the canonical grays. (Distinct from finding #1 — this layout issue persists even after the load bug is fixed, because the error state should be centered regardless.)

## 4. Doc-drift notes
- E05 confirmation copy is "✓ Saved successfully" (guide: "Message saved").
- E04 details page + D07: no doc drift.
- MSG D08: ID screen has no inline "rejected" state — rejection is communicated via notification + return-to-upload (matches guide wording).
- D03 dated copy now renders (guide's earlier note resolved on this build).

## 5. Config / fixture state left behind (seed-resettable unless noted)
- **Referred/ID state:** test-seller-3 ID **approved** (`d148ee0f`); test-buyer ID **approved** (`34254b02`, pre-existing); test-seller ID **rejected** (`76592772`, reason unclear_photo — resubmittable). These are additive identity states on standing personas.
- **Dispute fixture consumed:** trade `943097a5` is now `completed`/`resolved` (H05/H06) — the message thread on that trade still exists.
- **Moderation fixtures INTACT** (untouched by G-series because blocked): `ba6345ce` flagged, `ccf97ae4` rejected-fresh, `e2096de2` rejected-backdated, `afd3384a` needs_edits, `ce322cd9` rejected-appeal3 — all on test-seller.
- **Config reverted + verified:** referral `sp_config.referral_program_enabled=true` (baseline); message template `approved_email_body` restored to original; moderation config keys untouched.
- **Message templates:** `approved_email_body` edited then reverted (Last-updated bumped to 21:37 — cosmetic).
- **App state:** device logged out (Landing/signup screen); admin portal logged in as samer (left open).

## 6. QA Session Handoff

**Test Scope:** QA Task 25 consolidated: MSG E02/E03/E04/E05/D07/D08/R04 + G01–G07/H05/H06; SUB C09/D03/E03/E04 + D06/D07/L02; DT97 5-1..5-4.
**Design-System Compliance:** PASS on screens verified (no new deviations); no re-audit of full screens this run. DT97 items confirmed on-device (5-3 outline button; 5-4 dim). Note: the "Under Review" status pill is amber (info treatment) — consistent with prior PASS, not re-flagged. One deviation logged: the Safety Review error-state alignment (finding #7).
**Perceived Load-Time Verdict:** GOOD — all observed transitions this session (screen navs, deep-link landings, admin actions, ID submit → dialog, disputes, Manage screen) rendered within the <3s ideal threshold; no ≥3s transition flagged. (Not a formal profile.)
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ID Verification pending/verified/upload screens: copy + secondary-outline button match design requirements.
- CONFIRMED — Subscription Expired screen (D03) + Manage Kids Club+ expired (C09): info box + copy align (infoBox blue treatment).
- CONFIRMED — Transaction History: FAILED badge red on white, standard badge treatment.
- CONFIRMED — Referrals paused/normal states (5-4).
- DEVIATION — Safety Review error state ("Unable to open safety review / Listing not found"): content top-pinned (not vertically centered), mixed title/subtitle alignment, full-bleed Back button, Tailwind gray tokens — not the standard centered empty-state treatment (finding #7).
- DEVIATION — Transaction History failed-charge row: per-row error message not rendered (finding #4 — copy/functional gap, not a color/layout deviation).
**Verdict Summary:** 10 PASS / 1 PARTIAL (MSG E04) / 1 FAIL-finding (SUB E03 error-message) / 7 BLOCKED (MSG G01–G04,G06,G07 — app bug) + 2 source-confirmed-not-redriven (5-1,5-2) + 2 GATED (D06/D07) + 1 PASS-cross-ref (L02). [Full roll-up below in the batch table.]
**Critical Findings:** see §3 (ranked 1–4 the ones to read).
**App State Left Behind:** §5.
**Why It Matters:** MSG's last auth-unblocked ID-verification cases now pass against the live admin portal (E02/E03/E05/D07/D08), confirming the earlier 401 blocker is fixed; the R41 fixtures — built specifically to close MSG's G-series — surfaced a genuine HIGH app bug (seller Safety Review unreachable) rather than the fixture gap previously assumed; SUB's expired/failed-charge/subscription-status surfaces are now exercised live, with two real gaps (E03 error-message not shown; E04 details status) and L02 upgraded to PASS via DT99's independent grace/freeze verification.
**How to Verify/Reproduce:** screenshots in this run folder; Safety Review bug = log in as test-seller → deep link `p2pkidsmarketplace://listing-safety/ba6345ce-ed31-4a78-903f-32ccacbf53c4` → "Unable to open safety review"; E04 details bug = `/id-badges/d148ee0f-6471-460c-bd74-14cc9570cb70/details` → Pending; SUB E03 = test-buyer → Billing History → top FAILED row (no error text).
**What Needs To Be Fixed Next:** (1) HIGH — Safety Review must load a seller's own flagged/rejected/needs-edits listing (owner-scoped fetch bypassing the available-only filter). (2) Render `billing_history.error_message` under failed charges in TransactionHistoryScreen. (3) Fix the admin ID-badge details-page status for just-approved requests (stale read). (4) Investigate the public-profile self-view Verified staleness. (5) Optional: null `screenshot_path` post-decision. (6) UX — center + align the Safety Review error state (wrap in a centered flex container, center title/subtitle, max-width the Back pill, canonical gray tokens) so the error screen matches the app's other empty/error states.
**What Needs To Be Fixed Next:** (1) HIGH — Safety Review must load a seller's own flagged/rejected/needs-edits listing (owner-scoped fetch bypassing the available-only filter). (2) Render `billing_history.error_message` under failed charges in TransactionHistoryScreen. (3) Fix admin ID-badge details-page status for just-approved requests (stale read). (4) Investigate the public-profile self-view Verified staleness. (5) Optional: null `screenshot_path` post-decision.
**UX Enhancement Ideas (optional):** On the ID-verification upload screen after a rejection, the user returns to a generic "Verify Your Identity" upload state with no inline indication their previous submission was rejected — consider a small "Previous submission was not approved — see the reason in your notifications" note so the resubmission context is clear without opening the Notification Center.
**Suggested Next Session:** Dev fixes §"What Needs To Be Fixed Next" 1–3, then re-run MSG G01–G04/G06/G07 (fixtures are still staged) and MSG E04; a dev-stage of the R41 `notif-sub-event` rows unblocks SUB D06/D07.
**Suggested to Improve Agent Rules:** The profile-screen flingy-scroll consumed a disproportionate number of calls this session (repeated overshoots locating Billing History / ID rows). A standing note that the Profile ScrollView flingy-scroll (~950pt per swipe regardless of distance) should route to (a) deep-link destinations (TransactionHistory `billing-history`, IDVerification `id-verification-upload` are registered) or (b) screenshot-OCR positioning rather than swipe-and-relist would prevent this recurring cost.
