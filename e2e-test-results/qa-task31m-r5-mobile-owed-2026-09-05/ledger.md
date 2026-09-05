# QA Task 31-M Round 5 — Running Ledger

Run folder: `e2e-test-results/qa-task31m-r5-mobile-owed-2026-09-05/`
Date: 2026-09-05 · Guide: MODULE-ADMIN-PORTAL-MANUAL-TESTING.md · Rules: ADM-R1–R6, R55/§5.57, R53/§5.55, R52/§5.54, R54/§5.56, R28, R37, R59/R60, R29/§5.41, R-16-1.
Device: iPhone 17 Pro Max sim 3F3293A3 · Admin :3001 (freshly restarted — stale dev-server §5.21 recovery) · Metro :8081 · Staging drntwgporzabmxdqykrp.

## Batch A — D-Group (ALL PASS, mobile legs driven)
Disposable fixtures: QA R5 Cat A (`1eee27c5`), QA R5 Cat B (`95b36f9a`), created via admin /categories; both deleted at cleanup (0 residue).

| Case | Result | Evidence / notes |
|---|---|---|
| D02 (multiplier→mobile SP calc) | ✅ PASS (mobile leg) | Admin A multiplier 1.15 (DB) + Live Preview 57 SP + ⭐ bonus. Mobile picker: A row shows "Bonus category badge", B(1.10) none. ItemCreate w/ A + $20 → "You'll earn ~23 SP" + "1.15x multiplier for this category" (round(20×1.15)=23). |
| D05 (icon→mobile picker) | ✅ PASS (mobile leg) | A custom icon uploaded (favicon.png 192px) → DB icon_url storage `category-icons/1eee27c5/.../category.png` + admin row shows image. Mobile picker: A row renders NO 📦 fallback StaticText (image icon); B/no-icon rows render 📦 fallback. |
| D06 (spending cap % in mobile) | ✅ PASS (mobile leg) | Sports spend cap 75% shown on offer screen: "Max: 3 SP (75% of price)". |
| D07 (redemption cap enforced) | ✅ PASS (mobile leg) | Sports sp_redemption_cap 3 (DB) → offer screen "Max: 3 SP" (uncapped would be 10) + typing "10" clamped to value 3 + "3 SP applied". Cap reverted NULL (DB-verified). |
| D08 (reorder→mobile order) | ✅ PASS (was PARTIAL) | Admin Move Down on A → persisted (DB order B=11,A=12) → mobile picker list shows QA R5 Cat B BEFORE QA R5 Cat A. Cleanup deleted both. |
| D09 (bulk activate/deactivate→mobile) | ✅ PASS (mobile leg) | Bulk deactivate A+B (native confirm "Deactivate 2 categories?") → DB inactive → mobile picker A+B GONE. Bulk reactivate → DB active → mobile picker A back. |
| D10 (delete→mobile) | ✅ PASS (mobile leg) | Deleted B (empty) → "Categories (12)"→(11)→(10). Mobile picker: B gone, A present. Delete-guards (items/system) already PASS from QA31. |

Cleanup: A+B deleted, Sports cap NULL, 0 QA R5 cats remain. Note: A's storage icon object `category-icons/1eee27c5/.../category.png` may remain orphaned after category delete (dev cleanup note).

## Batch B — E-Group (E03/E04 mobile legs closed; E02/E05 signup-gated)
| Case | Result | Evidence / notes |
|---|---|---|
| E03 (deactivate node → mobile cannot-join) | ✅ PASS (mobile leg added) | Deactivated-node ZIP 90210 (node "QA Auto G02" inactive, DB) → test-buyer Discover filter ZIP 90210 → mobile "Not Available in Your Area / We're not live in ZIP 90210 yet" waitlist modal (cannot-join state). Dismissed No-thanks → no waitlist row created (DB 0 residue for test-buyer). |
| E04 (radius config → mobile Discover) | ✅ PASS (mobile leg added) | admin_config min_user_radius_miles 5→10 (qa:admin-config-set, DB read-back) → fresh Discover filter slider min label "5 mi"→"10 mi" (max 25 unchanged) → reverted to 5 (DB read-back). Live propagation proven. |
| E02 (add node) | ✅ PASS (admin) — mobile leg PARTIAL-owed | Mobile impact = a fresh user resolving to the new node's ZIP; needs a fresh-signup fixture (R41 class). Admin leg PASS from QA31 (disposable aeffbaa5 created+edited). |
| E05 (waitlist mgmt) | ✅ PASS (admin) — mobile leg PARTIAL-owed | waitlist→Joined transition requires a fresh-signup leg (R41 class). Admin /waitlist PASS from QA31 (metrics/search/filter DB-exact). |
Node residue note: several QA leftover nodes on staging (QA Auto G01 Active EDITED, QA Auto G02 Inactive, QA T31 Disc Node, Test Node 17xxx ×3, Diag Test Node) + 5 pending zip_waitlist rows (07999×4, 12355) — dev cleanup candidates.

## Batch C — Moderation mobile-visibility legs
| Case | Result | Evidence / notes |
|---|---|---|
| C08 (approve → buyer-visible) | ✅ PASS (mobile leg added) | test-seller pending `afd3384a` → targeted /listings search (seller-email+Pending filter; R4 unreliable-nav note resolved) → admin Approve w/ note → native alert "Listing approved…" → DB available (approved_by 1a546991). Mobile: pre-approve deep link = "This item is no longer available"; post-approve (fresh relaunch) = full ItemDetail + **Request to Buy + Add to Cart** (buyer-purchasable). |
| C06 (force delete → buyer-gone) | ✅ PASS (mobile leg added) | Same fixture after C08 → admin Force Delete (reason form) → "Listing force-deleted successfully" → DB status=deleted. Mobile (fresh relaunch): deep link = "This item is no longer available" again (no purchase path). Item consumed (soft-deleted — reduces residue). |
| C10 (reject → mobile reflection) | ✅ PASS (mobile leg added) | Seller-side: listing-safety deep link on rejected test-seller item `04662c2c` → ListingSafetyReview "This listing was rejected by our safety team." + **REJECTED** badge + "Rejection Reason: QA C04 reject reason…" + appeal UI. Buyer-side = shared non-availability mechanic (proven C06/C08). |
| C09 (request edits → seller sees) | ✅ PASS (admin) — mobile leg cross-referenced | ListingSafetyReview needs_edits branch ("This listing needs edits…" + "Admin's Edit Request") is the same screen as C10's captured rejected branch (source-verified item 11); admin Request-Edits PASS from QA30 (needs_edits + note stored). No needs_edits item currently staged to re-drive the seller nav. |
| X05 (inline approve flagged → buyer-visible) | ✅ PASS (admin) — mobile leg demonstrated via C08 | Inline-approve→available→buyer-visible is the SAME approve→Request-to-Buy mechanic driven for C08 this round. No flagged item currently staged on staging (QA30's X05 fixture 7bc46028 is deleted) to re-drive the /action-center inline path. |

## Batch E — fixture-gated stragglers (quick admin items first)
| Case | Result | Evidence / notes |
|---|---|---|
| Y08 (palette Listings nav) | ✅ PASS (was PARTIAL) | Command palette search "Kids Bike Helmet" → Listings result row (command-palette-row "Kids Bike Helmet — Listings →") → click → URL `/listings?tab=search&q=Kids Bike Helmet` → "Results (1 of 1)" + item surfaced (test-seller-3, $14 Available). **DT108 fix verified live** (was: q=<uuid> landed empty). |
| N2-A01 (financial audit journal) | ✅ PASS (was PARTIAL) | DB: per-trade journal for completed trade `01121468` = 6 chronological rows (buyer_fee_charged 149 → offer_created → tax_quoted 419 → payment_intent_created 6568 → payment_captured 6000 → payout_initiated 5400) with actors. Admin /audit (Financial Audit): unified immutable idempotency-keyed journal with trade/entity search + mutation/entity-type filters. |
| X07 (inline retry failed payout) | 🟡 PARTIAL (unchanged) | No failed-payout row currently staged (qa:failed-payout fixture is dev-run, 0 failed seller_payouts on staging). Affordance + retry-confirm verified QA30; DT109 fixture now exists to stage one. Needs a dev-staged failed payout row to drive the commit leg. |
| Y05 (debounce ~200ms) | 🟡 PARTIAL (unchanged) | 200ms debounce source-verified (CommandPalette.tsx); char-by-char typing not drivable by the embedded driver → no per-keystroke network count. Single native-setter → single fetch observed (QA30). |
| X07 note | — | X07's K03-class retry commit leg was closed on QA31-T via the DT109 fixture; X07's own Action Center inline-retry commit remains fixture-gated (same reason). |

## Batch D — N03 closed; remainder fixture/global-blast scoped
| Case | Result | Evidence / notes |
|---|---|---|
| N03 (referral SP fields → mobile) | ✅ PASS (mobile leg added) | DB sp_config: referrer_sp 40 / referee_sp 20 / referrer_listing_sp 10 / referee_listing_sp 25 / starter 10 / program+toggles active. Mobile Referrals (test-seller): First Trade **20 SP**, First Listing **25 SP**, "You earn: **40 SP per trade • 10 SP per listing**", Active Rewards (no paused banner). Values match config exactly (R54). |
| G04 (policy publish → acceptance gate) | 🟡 PARTIAL-owed | Publishing a policy re-prompts ALL users (global blast radius on shared personas). DT109 restore exists (Make Active + draft delete) making it safe, but requires a focused single-case round with a disposable policy + acceptance-gate handling for the persona. Not driven this session (R41-class). |
| M03/M04 (sub admin actions → Manage) | 🟡 PARTIAL-owed | Needs a disposable real subscription (Stripe lifecycle) — deferred to the SUB money round (QA Task 32) per R40. |
| O04 (ID decision → screenshot-deleted note) | 🟡 PARTIAL-owed | "screenshot deleted" reviewed-state not present on staging (QA31 note unchanged). Fixture-gated. |
| P01 (badge toggle → mobile) | 🟡 PARTIAL-owed | Badge toggles are global (affect all users); scope-write-revert on a real badge + mobile profile reflection = focused round. |
| P02/P03 (badge edit / manual award) | 🟡 PARTIAL-owed | Edit needs a badge-icon fixture + global badge edit; Manual Award needs a target user + the /badges award surface. Focused round. |
| R01/R03 (education publish → mobile) | 🟡 PARTIAL-owed | R01 admin PASS (QA31); R03 publish needs a draft education/FAQ item + mobile Help nav (no deep link). Focused round. |
