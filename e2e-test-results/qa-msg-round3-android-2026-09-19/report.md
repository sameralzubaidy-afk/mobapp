# QA Task — MSG Module, Round 3 (Android, Full Closeout) — 2026-09-19

**Run folder:** `e2e-test-results/qa-msg-round3-android-2026-09-19/` (`report.md`, `ledger.md`, `screenshots/` 43)
**Device:** Android `Medium_Phone_API_36.1` (adb `emulator-5554`) — mobile-mcp device id is the AVD name, **not** `emulator-5554`
**Build:** HEAD `69211387` (FIX-Task-66), Metro `:8082` (`EXPO_METRO_CACHE_TAG=android`), iOS Metro `:8081` left untouched
**Admin:** live portal `:3001` (owner-signed-in session in the shared browser page), `/id-badges`, `/id-badges/messages`, `/items/flagged`
**R29 busy check:** performed — `adb devices` + `pgrep -l -f "expo start"` + `lsof :3001` before any device interaction.

---

## 0 · Step-0 reconciliation (R52/R56/R57)

| Check | Result |
|---|---|
| MSG tracker header | `PARTIAL 4 · OPEN 0` — **already corrected by Round 2** ✓ (Round 1 had left `PARTIAL 3 · OPEN 1`) |
| MSG totals | 72 = 65 PASS + 4 PARTIAL + 3 NOT-SUPPORTED + **0 Remaining** ✓ sums |
| **⚠ NEW tracker gap found (not previously reported)** | **Round 2 drove ~38 Android rows but wrote only 2 Android cells** (A08, A10) and 2 carried-forward rows (F04, F07). The other **~36 Round-2 Android verdicts live only in the round note + `qa-msg-round2-android-2026-09-18/report.md`**, so the Android column still reads `—` for rows that DO have on-disk Android verdicts. This round populates its **own** 17 rows' cells; the Round-2 remainder is explicitly flagged as an owed tracker-hygiene pass (see §7). |
| Product-deferred confirmations | **B05**, **J05**, **D10** still correctly marked `🚫 NOT-SUPPORTED` ✓ (verified in the tracker body; **not** re-driven, per the brief). **B05** = 0 `leaderboard_rank_up` notifications (no entry point). **J05/D10** = the live `notification_category` enum has no `id_verification` value. |
| I07 | still `BLOCKED (concurrency)` in Round 2 → unchanged, not forced. |
| ⚠ Brief inconsistency (flagged, not silently resolved) | Part A lists **J05** under "drive every MSG case without an Android verdict" while the same brief later says **do not re-drive J05** (product-deferred). The "do not re-drive" instruction was followed; the tracker's NOT-SUPPORTED marking was confirmed. |

### Environment events
- **The Android emulator shut down mid-session** (graceful external shutdown — the documented non-crash class). Rebooted with `-no-snapshot-load -memory 4096 -cores 4`. `ANDROID_HOME` is **unset** in this shell ⇒ the emulator binary must be called as `/Users/sameralzubaidi/Library/Android/sdk/emulator/emulator`.
- The dev client could not reach Metro (`ECONNREFUSED localhost:8082`): fixed with `adb reverse tcp:8082 tcp:8082` (+ `:8081`) then the dev-client deep link. **A cold reload was mandatory anyway (R79-1c):** Metro `:8082` started 07:56:05, HEAD `69211387` landed 08:00:29 ⇒ the running bundle predated FIX-Task-66.
- **R98 gallery seeding re-run and verified:** `bash scripts/qa/android-seed-media.sh --serial emulator-5554 --app com.sameralzubaidi.p2pmarketplace` → 6 images registered in MediaStore (the script's first run failed registration because the emulator had died mid-push; the re-run passed).
- Gboard stylus overlay disabled (`settings put secure stylus_handwriting_enabled 0`).
- `mobile_list_elements_on_screen` / `mobile_save_screenshot` needed explicit activation (app-management + screen-element groups).
- **`qa-login-as` DID work from the Landing screen** (contradicts the 2026-09-13 note that it only mounts in the authenticated stack) — a useful update to that fact.

### DB preconditions (read-only, before driving)
| Fixture | State |
|---|---|
| `user_notifications` body LIKE '%Invalid Date%' | **0** ✓ |
| Trade `b66ad08c-0553-48e5-8b76-35602e441071` | `in_progress` ✓ (A08 chips + A06 media unblocked) |
| test-buyer completed trades w/o a review | 44 completed / **37 unreviewed** ⇒ C01–C04 drivable |
| test-seller flagged/rejected/needs_edits items | 3 |
| pending `id_badge_verification_requests` | 25 |
| personas with **0** ID requests (upload reachable) | `qa-first-trade`, `test-buyer-2`, `test-payfail`, **`test-seller-2`**, `test-trial` |

---

## 1 · Part A — MSG Android verdicts driven this round

| TC | Verdict (Android) | Evidence |
|---|---|---|
| **A04** Receive a message in real time | ⏸ **BLOCKED (structural — concurrent actor)** | Same class as I07: requires a second live client/actor. No message-injection QA helper exists (`scripts/qa/*` has no message POST; `Qa*DeepLinkHandler` has no incoming-message simulation), and `mobile_open_url` cannot host a second session. Not a defect — a single-device structural limit. |
| **A05** Typing indicator | ⏸ **BLOCKED (structural — concurrent actor)** | Same as A04; the typing broadcast only fires from another live client. |
| **A06** Image message + full-screen viewer | ✅ **PASS** | `image-picker-button` → **Android system Photo Picker listed the 6 seeded images** → single select → `Done` → app crop editor (`crop_image_menu_crop`) → upload (`message-input-bar` controls all `disabled` = in-flight) → image bubble `message-5963d7ad…` right-aligned w/ timestamp+check → **DB**: `messages` row `5963d7ad-9c8e-49ac-a454-cf44c60a5f97`, `message_type='image'`, `content='Image'`, `image_url` = a real `chat-images` storage object, `delivery_status='sent'` → tap → **full-screen viewer** (`close-image-viewer`, rendered image). Screenshots 11–14. **Named gaps:** the upload-FAILURE alert limb was not induced; `swipe navigation` is N/A for a single image in this thread. |
| **B04** Badge celebration modal | ✅ **PASS** | `badge-celebration-modal` + `celebration-title` "🎉 New Badge Earned! 🎉" + badge icon + `badge-name` "First Trade" + `badge-description` "Completed your first trade" + `celebration-close-button` "Awesome!" (screenshot 34). Earned incidentally when switching to test-seller-2 (R10/§5.33 repurposing) — no fixture build needed. |
| **C01** Submit a post-trade review | ✅ **PASS** | `submit-review?tradeId=9c901926…` deep link → star-5 (5 gold stars) + comment + live **"48/500 characters"** → `Submit Review` → in-app **"Success / Your review has been submitted!"** → **DB** `reviews` `63ec7a89…` rating 5, `is_anonymous=false`, `review_status='active'`, comment verbatim. Screenshots 15–19. |
| **C02** Rating-required validation | ✅ **PASS** | `Submit Review` with no star → `GlobalAlertProvider` **"Rating Required / Please select a star rating before submitting."** (screenshot 16) — verbatim guide match; submission blocked. |
| **C03** Anonymous review | ✅ **PASS** (both limbs) | `anonymous-checkbox` ticked → submit → **DB** `reviews` `7df77b3d…` `rating=4`, **`is_anonymous=true`**; then the reviewee's public profile renders the review as **"Anonymous User"** with a generated "AU" avatar and no profile link (screenshot 22). |
| **C04** Skip review | ✅ **PASS** | `Skip for Now` dismissed the flow and returned to the chat; **DB**: no `reviews` row exists for that trade (Skip is a true no-op). |
| **C05** Review display + aggregate | ✅ **PASS** *(bonus re-verification)* | Seller profile: star row, **4.5**, **"(2 reviews)"**, `Reviews (2)`, per-star distribution 5★=1 / 4★=1 — exactly the two reviews C01/C03 created. Screenshot 22. |
| **C06** Report a review (reviewee) | ✅ **PASS** | Own-profile review card ⋯ (`review-menu-button`) → all **4** options present (`review-report-spam` / `-offensive` / `-false-info` / **`-other`**) → in-app confirm **"Report Review / Report this review as Spam?"** (`global-alert-button-0/1`) → **"Success / Review reported. Thank you!"** → **DB** `review_reports` `f56f9321…` reason `spam`; review `report_count` 0→1, `has_been_reported=true`, `review_status='pending_review'`. Screenshots 35–38. |
| **E02** Admin approve a request | ✅ **PASS** | `id-badge-review-…/review` → screenshot displayed → Approve + notes → **"Request approved successfully"** → **DB** `status='approved'`, `reviewed_at`, `reviewed_by='1a546991…'` (attribution present, R35), `approval_notes` verbatim, **`screenshot_path` NULL** (privacy promise held), **1 `id_badge_approved` notification** written. |
| **E03** Admin reject with reason | ✅ **PASS** | Reject submitted with no reason → **"Please select a rejection reason"**; the 6-option reason list matches the guide verbatim (`Unclear photo`/`ID expired`/`Name does not match profile`/`Multiple IDs in photo`/`Not a government-issued ID`/`Other`) → reason + notes → **"Request rejected successfully"** → **DB** `rejected`, `rejection_reason='unclear_photo'`, notes saved, screenshot deleted, **1 `id_badge_rejected` notification**. |
| **E05** Admin edit message templates (**Part B**) | ✅ **PASS — actual edit + save driven** | `Edit` on `pending_status_text` → edit → `Save` → the page renders **"✓ Saved successfully"** and bumps **"Last updated"** (9:07:43 AM) → **DB** `id_badge_verification_messages.message_text` persisted the change with `updated_at` matching the UI → re-edited back and re-saved; **final DB value = the pristine original** (zero residue). Screenshots: n/a (DOM/DB assertions). **Trap recorded:** the template editor is a real `textbox`; a generic `textarea:visible` locator matched the **global ⌘K search** input instead (which opened the command palette and blocked `Save`) — use `getByRole('textbox', { name: 'Enter message text...' })`. |
| **E06** New submission → admin alert | ✅ **PASS** | The D02 submission produced an `admin_notifications` row `notification_type='id_badge_submission'` with `entity_id` = the request id (links to the request) ✓, and the queue showed the new Pending row without a manual refresh (first row = the fresh submission). **Near-miss killed (no defect):** 3 rows exist per submission — but there are exactly **3 admins** and the 3 rows carry **3 distinct `admin_id`s** ⇒ the intended per-admin fan-out (`id-badge-submission-notification/index.ts` §"Send Admin Alerts"), **not** a duplicate-write bug. Blast-radius query run first per the brief: 52 notifications / 29 requests. |
| **F03** Share referral code | ✅ **PASS** | `share-btn` → **native Android share sheet** ("Sharing text") with preview: *"Join Kids Club+ and get 10 SP for trade and 25 SP for listing! Use my referral code: e3yac67h\n\nkidsclub://signup?ref=e3yac67h"* — code + link + **dynamic** bonus text matching the live `sp_config` rewards card (10/25). Screenshot 24. **↳ surfaced finding N1 (below).** |
| **G01** Listing flagged → Safety Review | ✅ **PASS** | `listing-safety/<id>` → "Safety Review" header + red ShieldWarning icon + status-specific **"This listing was rejected by our safety team."** + read-only preview (Science Kit / $20.00 / REJECTED) + **"Rejection Reason"** = the admin reason. Screenshot 39. |
| **G02** Appeal a flagged/rejected listing | 🟡 **PARTIAL** | **<10-char limb PASS:** `Appeal This Decision` with "abc" → **"Appeal Reason Too Short / Please provide at least 10 characters so admin can review context."** (screenshot 41) + char counter `3/500`. **Empty limb = 📄 DOC-DRIFT:** the CTA is `disabled` when the field is empty, so the guide's "Please explain why you are appealing this decision." alert is unreachable (same disabled-guard class as D05/H03). **Valid-appeal limb = BLOCKED by a product gate the guide omits:** submitting a ≥10-char reason on a *fresh* rejection → **"Error / Please edit your listing before submitting an appeal."** (screenshot 43) — the `edited_since_rejection` guard. Completing that limb needs an Edit-Listing→Save hop first (owed, see §7). |
| **H02** Admin approve a flagged item | ✅ **PASS** | Moderation Queue → Flagged filter → `review-item-…` → modal (title/description/price/status/**Latest Admin Decision Note**/Appeals/Seller appeal note) → `Approve & Make Available` → confirm **"Are you sure you want to approve this item and make it available?"** → **DB** `items.status='available'`, `approved_at` stamped, `flagged_at` cleared, `rejection_reason` NULL, **2 seller notifications** in the window (flag + approval). |

### Part A items **not reached** this round (explicit, per R13/R40)
| TC | Status | Reason |
|---|---|---|
| F06 (referral code at signup) | not reached | Needs a fresh signup run (new-user persona, ~10+ calls); budget went to the closed-out clusters. |
| F07 / F08 (referral program paused / admin reward config) | not reached | Referral settings live in **`sp_config`**, which `qa:admin-config-set` (R37) does **not** cover; needs the admin `/referrals` UI + a mobile re-check. |
| G03 (resubmit needs-edits) / G04 (remove flagged) | not reached | Both need dedicated fixture cycles (`qa:r41-moderation -- apply --state needs_edits|flagged` → Safety Review drive → reset). |
| G05 / G08 | not re-driven | Unchanged documented gates: G05's notification limb has **no producer** (product decision); G08's AI-image path hard-depends on `GOOGLE_VISION_API_KEY` (infra). |
| G06 / G07 mobile appeal legs | **admin legs DONE, mobile legs not reached** | Config round-trips executed and reverted (§3); the on-device appeal-limit / window-expired drives were not run. |
| G09 | not re-driven | Config round-trip already PASS on record; Android on-device limb not re-driven this round. |
| H03 / H04 | partial evidence only | H03's premise was confirmed from the modal itself (**"Decision Note (required for Reject and Request Edits)"** → the disabled-Reject guard is by design, the guide's alert is unreachable); the Reject-with-reason and Request-Edits drives were not completed. |
| H05 / H06 | not reached | Need a reported-dispute fixture (`qa:r41-dispute`) + the admin dispute pages. |

---

## 2 · Part C — FIX-Task-66 Verification (on-device, distinct from the fresh test-case verdicts)

| Item | Verdict | Evidence |
|---|---|---|
| **F2** accumulate unread → "Mark all read" → badge clears immediately | ✅ **VERIFIED** | Baseline: header bell badge **2** (screenshot 01) with DB `read_at IS NULL` = 2. Notification Center → `mark-all-read-link` → **no app restart**: the badge node **disappears from the AX tree** while still on the Notification Center, every row's label drops the `unread:` prefix, and the "Mark all read" link itself disappears. Back on Home the bell badge is gone while the chat badge stays **3** (screenshots 02/03/04). **DB read-back:** unread 2 → **0**, `read_at` stamped 12:48:20Z. |
| **F3** "Save Quiet Hours" tappable clear of the Sell FAB | ✅ **VERIFIED** | Notification Preferences at max scroll: `quiet-hours-save-button` occupies y2003–2117; the FAB band starts y2169 ⇒ **52 px clear** (screenshot 26). **Tapping its reported centre (540,2060) produced the in-app "Saved / Quiet hours have been updated." alert — not the Sell sheet** (screenshot 27) ⇒ Round 2's F3 (tap → Sell sheet) is confirmed fixed. |
| **F6** chat input sits above the keyboard | ✅ **VERIFIED** | Input field focused → keyboard up (Gboard, suggestion strip visible): the whole `message-input-bar` (paperclip · input · emoji · map-pin · send) renders **above** the IME with no overlap, and the floating tab pill is pushed off-screen (screenshot 09). |
| **F7** header unread count vs the documented 100-most-recent-trades limitation | ✅ **VERIFIED — accurate today, latent limit named** | Header chat badge = **3**; DB truth = **3** unread messages across the account's trades, and the **top-100-by-recency subset = 3** ⇒ `unread_hidden_beyond_100 = 0` even though the account holds **275** trades. So the ≤100-trade iteration under-counts **nothing** today: **acceptable as-is**. Residual (named): a user whose only unread messages sit on trades older than their 100 most recent would under-count; the fix is an aggregate RPC (already tracked in the F7 note). |
| **Items 12–13** bottom-clearance spot-check (4 screens, max scroll) | ✅ **VERIFIED with one caveat** | **Notification Preferences** — the last *control* (Save Quiet Hours) clears the FAB by 52 px; the **non-interactive** footer note ("Critical system alerts and safety notifications cannot be disabled.") does render under the pill. **Profile** — at max scroll the last *controls* (`profile-logout`, `profile-help-support`) are clear of the pill; the tail star-distribution **text** rows sit under it; mid-scroll positions do pass controls under the pill (expected for a floating pill, not a defect). **ID Verification** — `id-verification-submit-btn` (y1741) clears the pill. **Referrals** — `share-btn` clears the pill; the `Referral History` **header** sits under it. Screenshots 25/26/28. |
| **MSG-TC-A08** quick-reply chips on the `in_progress` trade | ✅ **VERIFIED** | Opening `b66ad08c…` chat (after the once-per-listing safety modal) renders `quick-reply-chip-today` / `-tomorrow` / `-suggest` + `quick-replies-toggle` (map-pin filled). A chip tap **inserted its template text into the input** ("I'm available on [DATE] at [TIME]…") — the guide's "inserted as a message" behavior. Screenshot 07. **↳ surfaced finding N2 (below).** |
| **MSG-TC-A06** seeded gallery media drives image-send end-to-end | ✅ **VERIFIED** | See the A06 row — the R98 seeded set is what made the picker non-empty; the send completed to a real storage upload. |
| **Invalid Date sanity check** | ✅ **VERIFIED** | `SELECT count(*) FROM user_notifications WHERE body LIKE '%Invalid Date%'` → **0**. Live corroboration: the Notification Center's "Subscription Cancelled" row body reads *"Your Kids Club+ subscription has been cancelled. You'll have a grace period…"* — **no date clause at all** (the FIX-Task-66 contract: when the date is unavailable, **omit** the clause rather than print a placeholder). Screenshot 02. |

---

## 3 · Admin config round-trips executed (and reverted)

| Key | Before | Written | Verified | Reverted to | Verified |
|---|---|---|---|---|---|
| `moderation_appeal_max_attempts` | 3 | **1** | ✅ helper DB read-back | **3** | ✅ helper DB read-back |
| `moderation_appeal_window_days` | 14 | **1** | ✅ helper DB read-back | **14** | ✅ helper DB read-back |

Written through the sanctioned `npm run qa:admin-config-set` (R37 — the same shared RPC the admin settings pages use), never a raw SQL write. **R28 disarm/revert discipline satisfied by DB read-back on both legs.**

---

## 4 · New findings

### N1 · MED · The referral share/copy link uses an **unregistered** URL scheme
- **What the user gets:** sharing or copying the referral code hands over `kidsclub://signup?ref=<code>` — a link that **no app on either platform can open**, so the recipient cannot deep-link into signup with the code.
- **Root cause (exact line):** `p2p-kids-marketplace/src/services/referralCodeV2.ts:151` — `getReferralLink()` returns `` `${baseUrl}?ref=${code}` `` with `const baseUrl = 'kidsclub://signup'` (L150-152).
- **The registered schemes (verified live):** Android `android/app/src/main/AndroidManifest.xml:40-41` → `p2pkidsmarketplace`, `exp+p2p-kids-marketplace`; `app.json` `scheme` = `p2pkidsmarketplace` + `intentFilters[].data[].scheme` = `p2pkidsmarketplace`; iOS `ios/PassItUp/Info.plist:32-39` → `p2pkidsmarketplace`, `com.sameralzubaidi.p2pmarketplace`, `exp+p2p-kids-marketplace`. **`kidsclub` appears in none of them.**
- **Blast radius:** exactly **2 call sites** — `src/screens/referrals/ReferralsScreen.tsx:80` (Copy) and `:127` (Share) — i.e. **100% of referral link hand-offs** are dead. The string is also locked in by tests (`referralCodeV2.test.ts:290`, `referrals-v2.e2e.ts:360/426`) so a fix needs the assertions updated. Note the e2e test's own mock expects a **web** form (`https://app.kidsclub.com/signup?ref=`) — evidence the intended design is a universal/web link and the `kidsclub://` scheme is a stale placeholder.
- **Evidence:** live share-sheet preview (screenshot 24) + the manifest/plist/`app.json` grep above.
- **Recommended fix (separate dev task):** build the link from the registered scheme (`p2pkidsmarketplace://signup?ref=`), or a real https universal link if the intent is web-first; update the 3 test assertions.
- **Why it matters:** the referral program's only viral channel is the shared link; code entry at signup still works, so this is a functional-loss (not a data-loss) defect — MED.

### N2 · LOW–MED · Quick-reply chip row overflows the Android viewport; the `+ More` expander is off-screen
- `QuickReplyChips.tsx:45` sets `INITIAL_VISIBLE = 3` and renders 3 chips **plus** a `quick-reply-chip-more` ("+ More") expander inside a horizontal `ScrollView`. On Android the 3rd chip's label itself is **clipped at the right edge** ("🗓 Suggest t…") and `quick-reply-chip-more` is **outside the viewport** (AX tree reports neither; full-frame OCR of the chip band reads only the three chip labels — screenshot 07 + `qa:ocr` region `0,1780,1080,140`).
- **Impact:** the two remaining chips (`📍 Public place only`, `⏰ Running late`) — which the guide's A08 expected-result lists — are reachable only by a horizontal scroll the user has no affordance for; the third chip reads as broken text.
- **Fix options:** reduce chip padding/label copy, or wrap the row, or pin "+ More" as a fixed trailing element.

### N3 · LOW · "Review undefined" leaks into the screen title while the review eligibility check runs
- Deep-linking `submit-review?tradeId=…` renders `screen-title` = **"Review undefined"** during the "Checking review eligibility…" phase (before the reviewee name resolves to "Review Test Seller 2"). Raw/placeholder value on a user-facing title — §6.3 class. Reproduced on both C01 and C03 entries.

### N4 · DOC-DRIFT · MSG-TC-G02's expectations don't match the shipped appeal gate
- (a) With the reason field **empty** the `Appeal This Decision` CTA is `disabled`, so the guide's empty-reason alert ("Please explain why you are appealing this decision.") is unreachable.
- (b) A valid (≥10 char) reason on a **fresh** rejection is rejected with **"Please edit your listing before submitting an appeal."** — an undocumented `edited_since_rejection` precondition. Either the guide needs the edit-first step, or the gate needs an in-screen explanation (UX). Screenshot 43.

### Near-miss killed before filing (no defect) — recorded for rigour
- **3 admin notifications per ID submission** looked like a duplicate-write bug; **R100 writer-naming + a `count(*)` fan-out check killed it**: 3 rows = 3 distinct admins (3 `role_based_access_control` admins) = the intended per-admin alert loop. Blast-radius numbers (52 notifications / 29 requests) are *expected* under a multi-admin roster.
- **Profile "Help & Support / Logout under the pill"** at a mid-scroll position looked like a bottom-clearance regression; the **max-scroll** re-check showed the last *controls* clear and only tail **text** rows under the pill ⇒ the items-12–13 fix holds; the mid-scroll overlap is inherent to a floating pill.

---

## 5 · Money / state verification layers
**No money/SP/fee/tax/payout write was touched this round** ⇒ UI→DB→Provider layer 3 is **Stripe N/A — no money object**. State-writing cases and their verified layers: reviews (2 rows + 1 report row → DB read-back), ID badge requests (approve/reject → DB + screenshot-path deletion + notification rows), item moderation (flagged→available → DB + seller notifications), templates (edit → DB `updated_at`/`message_text`), notifications (mark-all-read → DB `read_at`), chat image message (DB `messages` row + storage object). **No `SUPABASE_SERVICE_ROLE_KEY` was requested or used by me; `qa:admin-config-set` / `qa:r41-moderation` read it from `.env` themselves (sanctioned tooling).**

---

## 6 · App state left behind
- **test-buyer**: 1 new **image message** on trade `b66ad08c…` (real `chat-images` upload); **2 new reviews** submitted (5★ public on trade `9c901926`, 4★ anonymous on `25beb9dc`); **all notifications marked read** (unread 2 → 0); notification-bell badge cleared.
- **test-seller-2**: profile now shows **Identity Verified** (its pending ID request was approved during E02 — a real decision, fixture consumed); +1 pending request earlier approved; 2 reviews received (aggregate 4.5 / 2 reviews); **1 review reported** (spam) → `review_status='pending_review'` (a **new row in the admin reviews queue**); **1 new badge** (First Trade).
- **test-seller**: `0dca235c` "QA Canned Cancelled-Trade Item" **flagged → approved → available** (H02; `approved_at` stamped); new `admin_notifications` read/unread rows for the flag+approval.
- **test-free**: its pending ID request was **rejected** (E03 fixture consumed, per the guide's own E03 flow).
- **admin_config**: both keys written and **reverted with DB read-back** (§3).
- **Science Kit** (`0fe228ee`, test-seller-2) reset to `available` after the G-series fixture.
- **Emulator**: left on the Safety Review screen, logged in as **test-seller-2**; Gboard stylus overlay disabled; `adb reverse` mappings for `:8081`/`:8082` still active; Metro `:8082` + iOS `:8081` + admin `:3001` left running.
- **No repo source / test / seed / config file was modified.**

---

## 7 · Known gaps / not tested (explicit)
1. Round-2's **~36 Android verdicts still have no Android cell** in the tracker (only a round note) — an owed **tracker-hygiene pass** (read `qa-msg-round2-android-2026-09-18/report.md` verdict list → populate the cells). Flagged, not silently fixed.
2. G02's valid-appeal completion (edit-listing → save → appeal) — owed.
3. G03, G04, G06/G07 mobile appeal legs, G09 on-device, F06, F07, F08, H03 (reject drive), H04, H05, H06 — not reached (reasons in §1).
4. A06's upload-failure alert limb not induced; A06 swipe-navigation N/A (single image).
5. A04/A05 remain structurally BLOCKED (no second actor).
6. iOS was booted but **not driven** (Android-scoped round, R80).

## 8 · Friction worth recording
- The mobile-mcp device id for the emulator is the **AVD name** (`Medium_Phone_API_36.1`), never the adb serial.
- The emulator died mid-session while the seeding script was mid-push; `qa:android-seed-media` then reported "0 registered / 6 absent" — a **true** signal that the device went away (not a script failure).
- The admin auth gate shows "Checking your admin session…" for several seconds on every navigation; reading too early looks like a wedged session. A **fresh page** (`forceNew`) resolved the earlier stale `:3001/id-badges` tab.
- The admin template editor is a `textbox`; a generic `textarea:visible` locator silently matched the **global ⌘K search**, opening the command palette and blocking subsequent clicks (recovered with Escape + a palette input focus).
- Overlay interception blocks Playwright coordinate clicks on the moderation queue (sidebar/main intercepts) → DOM-level `.click()` was required throughout the admin surface (§5.20 item 5).
- Referrals/Profile/Notification-Preferences all needed **deep links + ~2–3 flingy swipes**; the Profile ScrollView moved ~1000 px per gesture regardless of the requested distance.
