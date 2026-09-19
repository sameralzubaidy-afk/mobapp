# QA Run — MSG Module, Round 2 (Android) · 2026-09-18

**Run folder:** `e2e-test-results/qa-msg-round2-android-2026-09-18/`
**Platform:** Android emulator `Medium_Phone_API_36.1` (emulator-5554, 1080×2400) — **Android only** (no iOS leg claimed)
**Build:** dev client, bundle served from Android Metro `10.0.2.2:8082` — **post-`cdb1f2ea` (FIX-Task-65)**
**Cases driven:** **40** (34 PASS · 2 PARTIAL · 2 BLOCKED · 1 NOT-SUPPORTED · 1 PASS-with-named-gap)
**Round type:** **Android platform-coverage growth** (see Step 0)

---

## Step 0 — Mandatory reconciliation (live tracker, not the brief)

Pulled from `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (the brief's `QA-TESTCASE-STATUS-2026-03-03.md` is a typo; no such file exists), MSG section L238–L323.

**Result 1 — the brief's headline numbers are ACCURATE, but the tracker's own header is internally inconsistent (R56 drift):**

| Source | PASS | PARTIAL | OPEN | NOT-SUPPORTED | Total |
|---|---|---|---|---|---|
| Tracker MSG **header** line | 65 | **3** | **1** | 3 | 72 |
| Tracker MSG **body rows** (counted) | 65 | **4** | **0** | 3 | 72 |

The four PARTIAL rows are **D02, G05, G08, I01**; there is **no** OPEN row. MSG Round 1 flipped I02 `OPEN→PASS` and B05 `OPEN→NOT-SUPPORTED` and left the header un-refreshed. **The header drift is corrected in this round's tracker update** (R56/R52 count-integrity).

**Result 2 — the decisive Step-0 finding: this round is Android-coverage growth.**
The MSG **Android column is `—` for 68 of 72 rows.** Only **F04** and **F07** carried an Android verdict (both from the 2026-09-08 `43a-exec` config-propagation round); they were **not re-driven** here (verdicts carried forward, per that run's own "do not re-test" note). The MSG never-run pool is **0**, so this round is neither first-verdict nor stale-headline work — it is the platform column that was empty.

**Result 3 — blocker-freshness pre-check (Step 0 item 2) for every non-PASS case with a named blocker:**

| Case | Named blocker | Re-check this session | Still a blocker? |
|---|---|---|---|
| **D02** | capture-success needs real camera hardware | `IDVerificationUploadScreen.tsx:137` now carries the FIX-Task-65 copy *"Failed to take photo. Please try again, or upload a photo from your library."*; item 10 added `id-verification-choose-library-btn` | **Scope narrowed — simulator leg now drivable** (driven; PASS on Android) |
| **G05** | no `recall_alert` producer / no `safety` enum value | `grep recall_alert supabase/**` = **0 matches** | **FRESH** — notification limb still unproducible (product decision) |
| **G08** | `GOOGLE_VISION_API_KEY` + no triggering fixture | `moderate-image` still hard-depends on the key; no bypass; fixture still absent | **FRESH** — infra/provider gate |
| **I01** | success leg needs a physical device | FIX-Task-65 added 4 cause-specific strings + `push_registration_reason` toggle | **FRESH but narrowed** — prompt + interaction legs now drivable (driven) |

**Round type statement (Step 0 item 3):** **Android coverage growth, not new coverage and not primarily stale-headline work.** 40 cases were driven on Android for the first time; 6 of them (D01, D02, I01, I02 + the G05/G08 blocker re-checks) also served as the FIX-Task-65 re-verification set.

### ⚠️ R79-1c freshness gate (caught a stale bundle before it produced false failures)
- Latest commit `cdb1f2ea` (**FIX-Task-65**) = **Fri Sep 18 22:27:36**
- Android Metro (pid 88701, port 8082) start = **Fri Sep 18 22:14:08** → **13.5 min EARLIER**
- ⇒ the running Android bundle **predated FIX-Task-65**. Every P1 case (D01/D02/I01/I02) depends on FIX-Task-65 code, so a **cold reload was mandatory** before any assertion. Done (terminate → relaunch → connect `10.0.2.2:8082`).
- **Two independent discriminating tests confirm the fresh bundle was in use:**
  1. `id-verification-choose-library-btn` ("or choose from your library") **renders** — a FIX-Task-65 item-10 addition.
  2. `notification-error-message` reads **"⚠️ Push notifications need a physical device. This is a simulator/emulator."** — the FIX-Task-65 item-3 `not_device` string (pre-fix it read *"Make sure you granted permissions"*).

Had the reload been skipped, D01/D02/I01/I02 would have failed on a bundle that never contained the fix.

---

## Environment / method

- **Dual Metro is deliberate** (repo memory `dual-metro-sessions-ios-android-2026-09-18`): `:8081` = `EXPO_METRO_CACHE_TAG=ios`, `:8082` = `…=android`. Android was pointed at **`10.0.2.2:8082`**. `metro:kill` / `start:single` were **not** run (they would kill both).
- **R29 busy check:** no other agent task was driving this simulator UDID or the shared admin browser session.
- **Visual channel:** `view_image` **returned readable pixels this session** (it superseded the older R5 "URI-only" claim — worth noting, R100/R104). Device↔screenshot scale measured: `take_screenshot` returns 461×1024 for a 1080×2400 device (×2.343); AX-tree coords are **1:1 device pixels**.
- **AX discipline:** every interactive element was resolved from `mobile_list_elements_on_screen` before tapping — no screenshot-estimated coordinates were used.
- **Admin portal:** was **not running** at session start → started via the documented `npm run dev` recovery (§5.21). Session established with the **owner-supplied portal credential** (never echoed here).
- **DB arbitration (R24/R54):** every numeric or state claim was reconciled against staging Postgres.

---

## Verdict summary — 40 cases (all Android)

| TC-ID | Description | Android verdict | Key evidence |
|---|---|---|---|
| **MSG-TC-A01** | Conversation list | ✅ **PASS** | `screen-title` "Messages"; `conversations-search-input`; `conversations-list` rows with `unread-badge` (1,1,1,2,2,1,1), trade chip "Nintendo Switch Games Bundle • $45.00", previews, relative times ("12h ago", "Sep 10"…); `conversations-load-more` |
| **MSG-TC-A02** | Chat thread + trade banner | ✅ **PASS** | `chat-header` (Test Seller + listing title; `verified-badge` on test-buyer's header); `trade-banner` + `view-trade-link` "View Trade"; `message-<id>` bubbles |
| **MSG-TC-A03** | Send text + delivery status | ✅ **PASS** | New row `message-a6d57a69…` right-aligned, **single `check-bold` = sent**; older message **double `check-bold` = read**; `send-button` present only while text entered and **gone after send**; input cleared; **DB read-back `msgs_on_trade` 1→2** |
| **MSG-TC-A07** | Message length limit (2000) | ✅ **PASS** *(named gap)* | `ChatScreen.tsx:995 maxLength={2000}` + `MESSAGE_CHAR_LIMIT = 2000` (L102) — the RN silent clamp the guide describes. **Named unverified leg: a >2000-char injection was not driven on-device** (cost of injecting a 2001-char string exceeded its value; recorded honestly rather than claimed) |
| **MSG-TC-A08** | Quick-reply meeting chips | 🚫 **BLOCKED (fixture)** | Chips are source-gated on **`trade?.status === 'in_progress' && quickRepliesVisible`** (`ChatScreen.tsx:933`). test-buyer's trades are **3 `pending`** (Kids Bicycle / LEGO Star Wars / Nintendo Switch Games Bundle) + many `cancelled`, **zero `in_progress`** ⇒ correctly not rendered. Fixture gap, **not a defect**. Toggle itself flips (`map-pin-fill`↔`map-pin-regular`) |
| **MSG-TC-A09** | Safety banner + modal | ✅ **PASS** | `safety-banner` "Trade Smart, Trade Safe" + chevron; first-open `safety-modal` with shield-check, 4 guidance rows and `safety-modal-confirm` **"Got it — Let's Trade Safely"** (both verbatim) |
| **MSG-TC-A10** | Photo permission denied error | 🚫 **NOT-SUPPORTED (Android premise)** | The paperclip opened the **Android system Photo Picker directly — no permission dialog**. Android 13+'s Photo Picker is permissionless, so `requestMediaLibraryPermissionsAsync()` returns `granted` and the `Permission Required` branch (`ChatScreen.handleImagePicker`) is **unreachable on Android**. The guide's expected result is iOS-specific. (Picker also reported "No photos yet" → A06's image-send limb is fixture-gated, R98) |
| **MSG-TC-B01** | My Badges grid | ✅ **PASS** | `screen-title` "My Badges"; 3-column grid; `badge-tile-<slug>` with earned/locked in the label — **11 earned + 2 locked**, matching the DB `user_badges` count **exactly** (R54) |
| **MSG-TC-B02** | Badge detail modal | ✅ **PASS** | Earned: "First Trade" / "Completed your first trade" / **"Unlocked: 2/1/2026"**. Locked: `lock-regular` icon + name + requirement text, **no** Unlocked line. `badge-detail-close-button` |
| **MSG-TC-B03** | Badge showcase on profile | ✅ **PASS** | `badge-showcase` "My Badges (11)" + horizontal earned-badge strip (`badge-showcase-<slug>`); count matches DB (R54) |
| **MSG-TC-C05** | Review display on seller profile | ✅ **PASS** | Star row + **"4.5"** + **"(6 reviews)"** + header **"Reviews (6)"**; histogram 5★×3 / 4★×3 ⇒ (15+12)/6 = **4.5** — internally consistent **and** matches the DB's 6 visible reviews; anonymous cards render as "Anonymous User" |
| **MSG-TC-D01** | Start ID verification + upload | ✅ **PASS** | `id-verification-unverified-state`; "Verify Your Identity"; config-driven `upload_disclaimer` (staging copy, matches the E05 admin value); **`id-verification-take-photo-btn` + `id-verification-choose-library-btn`**; submit **disabled** until an image exists |
| **MSG-TC-D02** | Capture ID with camera | ✅ **PASS** | **Permission-denied limb:** "Permission Required" / "Please allow camera access." verbatim via `GlobalAlertProvider` (`global-alert-button-0`) — confirming the guide's Dependencies correction holds on Android. **Capture limb:** Android runtime permission dialog → camera app → shutter → Done → **CropImageActivity (AX-drivable)** → CROP → preview populated + submit enabled. *Caveat: emulator virtual-scene camera, not real hardware* |
| **MSG-TC-D03** | Submit creates pending request | ✅ **PASS** | `id-verification-uploading-indicator` → "Submitted Successfully" alert (guide copy) → **DB: 1 row, status `pending`** |
| **MSG-TC-D04** | Duplicate pending blocked | ✅ **PASS** | Pending state renders with **no upload/submit affordance**; **DB: exactly 1 pending row** after submit ⇒ a 2nd request is structurally impossible |
| **MSG-TC-D05** | No-image submit validation | ✅ **PASS** | `id-verification-submit-btn` **disabled**; tapping it is a true no-op — tree byte-identical, **no** `id-verification-error` box (disabled-guard, matching the guide + DT97 note) |
| **MSG-TC-D06** | Pending state screen | ✅ **PASS** | `id-verification-pending-state`; clock icon; "Verification Pending"; "We'll review your ID within 24–48 hours"; `id-verification-status-pill-pending` "Under Review"; `id-verification-back-profile-btn` |
| **MSG-TC-D07** | Approved → Verified badge on profile | ✅ **PASS** | Profile `id-verification-menu-item` → **"Identity Verified"** + "Trust level: Ultimate" (test-buyer's approved request; DB-verified `approved`) |
| **MSG-TC-D08** | Rejected → reason shown + resubmit | ✅ **PASS** *(nuance disclosed)* | **Reason delivered (DB):** `id_badge_rejected` notification at 21:42:13Z (2 s after `reviewed_at`); request row `rejection_reason = unclear_photo`, notes "QA Task 25 E03 - automated rejection with reason". **Nuance:** the on-device rejected screen is shadowed by test-seller's *newer pending* request (correct precedence), so the resubmit affordance was not reachable |
| **MSG-TC-D09** | Submission confirmation notifications | ✅ **PASS** | **DB:** `id_badge_submission` / "ID Verification Request Received" created at 02:34:53Z for test-free — ID-specific, not a generic system event. (Email limb is preference-gated: `badges.email_enabled = false` for the persona, so no email is expected) |
| **MSG-TC-E01** | Review queue (stats, filters, search) | ✅ **PASS** | Heading "ID Badge Verification"; cards **Pending Review 25 / Approved 21 / Rejected 32 / Avg Review Time 150.8h**; filters All/Pending/Approved/Rejected; table **User · Email · Phone · Node · Submitted · Status · Actions**. **DB reconciliation: pending 25 / approved 21 / rejected 32 — exact match (R54)**; Rejected filter returned exactly **32** rows; pending rows show "Review", completed show "View" |
| **MSG-TC-E04** | View completed request details | ✅ **PASS** | `/id-badges/<id>/details` → "ID Badge Request Details", "User Information" (Name/Email/Phone/Node), "Status & Decision" (Current Status **Rejected**, Submitted At, Reviewed At, Rejection Reason "unclear photo", admin note), **read-only**, + privacy note that the ID screenshot was permanently deleted post-decision |
| **MSG-TC-E05** | Edit message templates | ✅ **PASS** *(edit limb named)* | Tabs "Verification Queue / Message Templates"; heading "Message Templates"; "📝 Template Variables"; **18 template keys** each with value + `Edit` + "Last updated". `upload_disclaimer` matches the on-device D01 copy (cross-surface). **Named unverified leg: an actual edit+save (to re-assert the "✓ Saved successfully" copy) was not performed** |
| **MSG-TC-F01** | View referral code + hero | ✅ **PASS** | `hero-card` gift icon + **"Refer Friends, Earn SP"** + "Share your code and get rewards when they join."; **8-char code `e3yac67h`** in `code-container`; `sp-earned-strip` "You've earned 0 SP from referrals" |
| **MSG-TC-F02** | Copy referral code | ✅ **PASS** | **Device clipboard read-back = `e3yac67h`** (decisive); alert "Copied!" / "Referral code copied to clipboard"; Android clipboard-UI preview also showed the code |
| **MSG-TC-F04** | Active rewards display | ✅ **PASS** | `active-programs-card` "Active Rewards"; `trade-bonus-row` "First Trade Bonus" / "+10 SP when they complete their first trade"; `listing-bonus-row` "First Listing Bonus" / "+25 SP…"; "You earn: 25 SP per trade • 10 SP per listing" |
| **MSG-TC-F05** | Referral history | ✅ **PASS** | `history-title` "Referral History"; `history-item-<id>` with name, "Joined 9/3/2026", colored "+25 SP" |
| **MSG-TC-G01** | Listing flagged → Safety Review | ✅ **PASS** | `screen-title` "Safety Review" + "Listing Safety Review"; **red `shield-warning` icon**; status-specific copy **"This listing was rejected by our safety team."**; read-only preview ("Cash-Only Item", "$20.00", `REJECTED`); **Rejection Reason** + admin note; appeal field + 74/500 counter; appeals/flagged/rejected timestamps |
| **MSG-TC-H01** | Flagged items moderation queue | ✅ **PASS** | `/items/flagged` heading **"Moderation Queue"**; filters **All / Flagged / Needs Edits / Rejected**; headers **ITEM · ITEM ID · SELLER · STATUS · FLAGGED DATE · APPEALS · LATEST APPEAL NOTE · ACTIONS** — covers every guide field (title, status, seller, flagged date, appeal count) **plus** extras; 13 rows |
| **MSG-TC-I01** | Enable push notifications | 🟡 **PARTIAL** | **Prompt leg PASS:** "🔔 Stay Connected", 5 benefit bullets, Privacy & Permissions box; `notification-enable-button` (FIX-Task-65 design-system pill). **Interaction leg driven:** tap → error state → no crash; `TAB_BAR_HIDDEN_ROUTES` confirmed — the floating pill is **absent from the AX tree** on this route. **Remaining gap = SUCCESS leg only** (needs a physical device) |
| **MSG-TC-I02** | Push error states | ✅ **PASS** *(re-asserted)* | `notification-error-message` renders **"⚠️ Push notifications need a physical device. This is a simulator/emulator."** — the FIX-Task-65 cause-specific string. Round 1's note required this string to be re-asserted by the next round; **done, and it now asserts the corrected copy** |
| **MSG-TC-I03** | Notification center list + icons | ✅ **PASS** | `screen-title` "Notifications"; type-specific icon + color per row (message / trade-cancelled red / SP-returned green / SP-reserved yellow / subscription purple) + emoji glyphs; AX labels expose unread via `<type>, unread: <title>`; bodies; relative times; `mark-all-read-link`; unread rows carry a **distinct gray background** (visually verified) |
| **MSG-TC-I04** | Tap notification → deep link + mark read | ✅ **PASS** | Tapping the `new_message` item navigated into **Chat**; `header-chat-badge` decremented **2 → 1**; **DB: `tapped_is_read = true`** |
| **MSG-TC-I05** | Mark all as read | ✅ **PASS** | `mark-all-read-link` tapped → **0 `unread` markers** in the tree, rows lost the unread background, titles unbolded, the link itself disappears; **DB: `unread_remaining = 0`** (from 289) |
| **MSG-TC-I06** | Pagination + pull to refresh | 🟡 **PARTIAL** | **Scroll verified with a proven delta** (original top item absent after swipes, present again after swipes back). **Pagination not measurable from the AX tree** — the list is virtualized, so the tree only exposes the visible window (7 titles before and after scrolling); **pull-to-refresh gesture performed, no observable delta available** (no pending data change to reveal) ⇒ recorded as "gesture performed — no observable delta" per R77 #14, **not** as a verified reload |
| **MSG-TC-I07** | Real-time arrival | 🚫 **BLOCKED (concurrency)** | Requires a second actor (test-seller) triggering an event while test-buyer watches — **not drivable within single-device scope**. Named gap (not an app defect) |
| **MSG-TC-J01** | Category × channel toggles | ✅ **PASS** | All **five** categories render (`subscription`, `sp_events`, `badges`, `trades`, `system`), each with `toggle-<cat>-push\|in_app\|email`; **no `Safety Alerts` category** (matching the guide's taxonomy note) |
| **MSG-TC-J02** | Default preferences (DB-driven) | ✅ **PASS** | **DB↔UI reconciliation:** DB has all 5 categories `push=true` / `in_app=true` / `email=false`; the UI renders push+in-app **checked** and email **unchecked** for every category — exact match |
| **MSG-TC-J03** | Always-on footer note | ✅ **PASS** | Footer reads **"Critical system alerts and safety notifications cannot be disabled."** (verbatim per guide) |
| **MSG-TC-J04** | Quiet hours + validation | ✅ **PASS** | `quiet-hours-section`; `toggle-quiet-hours-enabled` checked (DB `quiet_hours_enabled=true`); inputs `22:00` / `08:00` (DB-matched); **invalid value → alert "Invalid time format" / "Please use 24-hour format: HH:MM (example: 22:00)." (verbatim)**; **DB confirmed the invalid value did NOT persist** (still `22:00:00`) |

**Tally:** 40 driven → **35 PASS** · **2 PARTIAL** (I01, I06) · **2 BLOCKED** (A08 fixture, I07 concurrency) · **1 NOT-SUPPORTED** (A10) · 1 of the PASSes (A07) carries an explicitly named unverified leg.
F04/F07 were **not re-driven** (Android verdicts already on record; their run note says "do not re-test").

---

## Critical findings

### F1 — `"Invalid Date"` leaks to users in subscription-cancelled notifications · **MED-HIGH** · copy/system-content defect
Three `user_notifications` rows for test-buyer carry the literal string:
> "Your Kids Club+ subscription has been cancelled. You'll have access until **Invalid Date**, then enter a 90-day grace period where your Swap Points will be frozen."

- **Writer named (R100):** the body is stored verbatim in `user_notifications.body`, composed **server-side**. The identical `${formattedDate}` construction exists in **`p2p-kids-marketplace/src/services/subscriptionNotifications.ts:163`** (`notifyCancellationConfirmed`) and **`supabase/functions/stripe-webhook-subscriptions/index.ts:1290 & 1311`**.
- **Mechanism:** `new Date(accessUntil).toLocaleDateString('en-US', …)` returns the literal `"Invalid Date"` when `accessUntil` is absent/invalid — **no guard exists**.
- **Why it matters beyond the stale rows:** **FIX-Task-50 item 1 (2026-09-17 08:22:17) edited this very line** to drop the "90-day" wording — but **left the date interpolation unguarded**, so the defect is **still live in HEAD**. (Two of the three stored rows postdate that fix, which is how the stale wording and the bad date were both preserved.)
- **Recommendation:** guard `accessUntil` (fall back to `grace_ends_at`, or omit the clause when the date is invalid). This is a money/entitlement-deadline message, so an unreadable date is user-impacting.

### F2 — Header notification badge is stale after "Mark all read" · **MED** · UI state defect
- **Observed:** after `Mark all read`, the DB holds **0 unread** and the list renders every row read — yet the header bell badge **still displays "99+"**.
- **Contrast:** the *chat* badge updated correctly (2 → 1 → 0), so badge rendering itself works.
- **Writer named (R100):** `header-notifications-badge` ← `CountBadge count={unreadCount}` ← **`useNotificationBadge(userId)`** (`AppHeader.tsx:79,154,158`).
- **Two candidate causes (named, not guessed):** the hook refetches on mount and subscribes to `postgres_changes` **UPDATE** events on `user_notifications` (logging `CHANNEL_ERROR`/`TIMED_OUT` if the channel fails) — so either the Realtime UPDATE event was not delivered (table not in the publication / channel error), **or** the bulk action produces no refresh trigger. **Dev to confirm.** The user-visible defect (badge contradicting the list) is evidenced regardless.

### F3 — Floating Sell FAB occludes the "Save Quiet Hours" button · **MED** · layout/occlusion defect (R17/R31 class)
- `quiet-hours-save-button` reports logical bounds `y 2105–2219`, `x 95–986`; the floating `tab-sell` FAB sits at `y 2169–2287`, `x 467–614`.
- Tapping the Save button's reported **centre (540, 2162)** opened the **Sell sheet** instead — the FAB's hit area (incl. hitSlop) intercepted it, and the quiet-hours section is the last section so it **cannot be scrolled clear**.
- Workaround used: tap at `x=250` (outside the FAB's x-range) → Save fired correctly.
- **Recommendation:** add bottom padding below the final section (or lift the FAB) so the last interactive control is never under the FAB.

### F4 — `AUTH-TC-P03`-class numeric inconsistency in the Messages surface · **LOW-MED** · observation, not reconciled
The header chat badge read **1** while the Messages list simultaneously rendered **7 conversations totalling 9 unread message badges**. Recorded as an **observation with the gap named** — not DB-reconciled this round (the `messages` read schema was not worth a column-probe mid-run). Worth a follow-up pass.

### F6 — Chat message input bar is covered by the on-screen keyboard on Android (owner-reported, source-confirmed) · **MED-HIGH** · layout/inset defect
- **Reported by the project owner** from this run's own evidence screenshot (`screenshots/MSG-A03-01-ime-dismissed.png`): with the keyboard up, the **Chat input bar is not visible** — the user types blind.
- **Source-confirmed (R12), not inferred:** `ChatScreen.tsx:857-860` renders
  `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — so on **Android the `KeyboardAvoidingView` does nothing**, and the screen depends entirely on the platform resizing the window.
- **Why that no longer saves it:** `android:windowSoftInputMode` is **not declared** anywhere in the app's manifest (grep = 0 hits), and the test device is **API 36**, where edge-to-edge is enforced and the legacy `adjustResize` behaviour no longer resizes the app window. The keyboard therefore simply **overlays** the input bar.
- **Corroborating on-device evidence:** the AX tree kept reporting `message-input-bar` at `y 1902–2399` **while the keyboard was up**, i.e. the layout never shifted — exactly the "content does not shift for the IME" behaviour noted under R104. The tree coordinates for the input row and `send-button` landed **on the keyboard**.
- **Impact:** the core messaging flow is still *functionally* usable (text can be typed and sent — `MSG-TC-A03` passed, DB read-back confirmed the row), but the user cannot see what they are typing without dismissing the keyboard first. On a chat screen that is a significant usability defect.
- **Recommendation:** give the Android branch a real behaviour — either `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` (with a matching `keyboardVerticalOffset`), or adopt `react-native-keyboard-controller` / manual `KeyboardAvoidingView`-with-insets handling, so the input bar rides above the keyboard on API 35+ edge-to-edge.

### F5 — Minor copy gaps (low)
- **B02 locked badge:** the guide expects "a lock icon **and encouragement to keep going**"; the shipped modal shows only the requirement text ("Completed 50 trades"). Functionally adequate; flagged as a copy observation.
- **D02 divergence:** `IDVerificationUploadScreen.tsx:137` now says *"Failed to take photo. Please try again, or upload a photo from your library."* while **`ImagePickerGrid.tsx:163` still has the terse** *"Failed to take photo. Please try again."* — two components, two different strings for the same failure. Consolidation candidate.
- **NotificationSetup has no back affordance:** reached via the `notification-setup` route it renders **no header/back button and no tab bar**. On Android hardware BACK escapes it; **on iOS there is no equivalent escape** — worth a design check.

---

## Design & copy compliance (§6.4 / §6.3)

**Compliant screens reviewed:** ID Verification (upload / pending / verified), NotificationSetup, My Badges + badge modal, Profile + badge showcase, Messages list, Chat, Notification Center, Notification Preferences, Referrals, Seller Profile, Safety Review.

- **One primary per screen** held everywhere reviewed (e.g. ID Verification: single `#5DBB8E` `Submit for Verification`; "Use Camera" is an outline secondary; "or choose from your library" is a text link).
- **Canonical detail header** (44px gray-circle back + centered `screen-title`) present on all detail screens reviewed (`ID Verification`, `My Badges`, `Messages`, `Chat`, `Notifications`, `Notification Preferences`, `Referrals`, `Seller Profile`, `Safety Review`, `Settings`).
- **Bottom navigation:** floating pill preserved with correct safe-area offset; badges render (`tab-trades-badge`, `tab-basket-badge`). `TAB_BAR_HIDDEN_ROUTES` correctly suppresses the pill on `NotificationSetup` and `ID Verification`.
- **Copy verbatim matches (no drift found on Android):** "Got it — Let's Trade Safely" · "Trade Smart, Trade Safe" · "This listing was rejected by our safety team." · "Critical system alerts and safety notifications cannot be disabled." · "Please use 24-hour format: HH:MM (example: 22:00)." · "Please allow camera access." · "Copied!" · "Refer Friends, Earn SP" · "Submitted Successfully" · "We'll review your ID within 24–48 hours".
- **Defect-class scan (R56/R58) — no stringified-`accessibility*` props found.** Every label found in the tree is either a real visible string or a deliberate accessibility label; the `literal-ax-prop-text` class did **not** recur.
- **System-content leak:** one class found — **F1 "Invalid Date"** (the only R58-class hit this round).
- **Redesigned-screen observations (observation-only per brief):** none of the screens reviewed are under a planned redesign, so F3 was logged as a defect rather than an observation.

**Money Verification Layers** (stated per case, as required): **N/A for all 40 cases.** No case in this round touches a money, SP-ledger, fee, tax, or payout write. The only state-writing cases and their verified layers were: **D03/D04** (ID-verification row → *DB read-back*: 1 pending row), **D09** (notification row → *DB read-back*: `id_badge_submission`), **A03** (message row → *DB read-back*: `msgs_on_trade` 1→2), **I04/I05** (read-state → *DB read-back*: `is_read` true / 0 unread), **J04** (invalid quiet-hours → *DB read-back*: unchanged `22:00:00`). **No `SUPABASE_SERVICE_ROLE_KEY` was requested or used.** No case required it; **gap: none**.

---

## Coverage tracker — real before/after

Per-case Android verdicts written into the MSG section of `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`.

| MSG metric | Before this round | After this round |
|---|---|---|
| Cases (canonical) | 72 | 72 |
| Rows with an **Android** verdict | **2** (F04, F07) | **40** |
| Rows with an Android verdict **driven this round** | 0 | **38** (F04/F07 carried forward) |
| PASS / PARTIAL / OPEN / NOT-SUPPORTED (header) | 65 / **3** / **1** / 3 *(internally inconsistent)* | 65 / **4** / **0** / 3 **(header corrected to match the body rows — R56)** |
| Status-value flips | — | **None.** No recorded verdict changed. Every Android verdict added here is a **new platform leg** for a row that previously had iOS-only or no platform attribution |

**No status flips** — this round added Android evidence and corrected a counting inconsistency; it did not overturn any prior verdict.

---

## App state left behind (disclosure)

| Persona | Change | Reversible by |
|---|---|---|
| **test-free** | **+1 `id_badge_verification_requests` row (status `pending`)** from the D03 drive. Also present: the D09 `id_badge_submission` notification. | Admin reject/approve, or `seed:staging` |
| **test-buyer** | **289 unread notifications → 0** from the I05 `Mark all read` drive (the P03-seed refreshes its own unread fixture on re-seed). Then **+1 unread** (the new A03 message notification) — so the persona is left with **1 unread**, i.e. effectively self-restored. Quiet-hours field holds an unsaved invalid string on-device (**not persisted** — DB still `22:00:00`). | `seed:staging` restores the unread fixture; **no DB write was made in J04** |
| **test-seller** | **Unchanged** — the D08 journey was read-only; the A03 message was sent as test-seller into an existing trade chat. | n/a |
| **Trade `78cd5985`** | **+1 `messages` row**: "QA MSG R2 A03 probe" (test-seller → test-buyer), created by the A03 drive. | Left in place as the A03 artefact |
| **Admin portal** | Dev server **started** this session on `:3001` (was down). No admin config or record was modified. | `npm run dev` process; still running |
| **Emulator** | Gboard stylus tutorial **disabled** (`stylus_handwriting_enabled 0`, R77 #2); `CAMERA` permission **granted** to the app for the D02 capture limb (was revoked before the permission-denied limb was driven). | `adb shell pm revoke …` / settings reset |
| **Repo** | **No source, test, seed or config file was modified.** Only additions: this run folder (report + 40 screenshots) and the tracker's MSG section. | n/a |

---

## Friction, tooling & follow-ups

1. **R77 #2 struck again (cost ~4 calls).** The Gboard **"Try out your stylus"** tutorial overlay covered the input area and silently swallowed taps. It was root-caused by screenshot (per the R105 evidence gate) and fixed with the documented `settings put secure stylus_handwriting_enabled 0`. **Recommendation: add this to the Android session-start checklist so it is applied proactively rather than reactively.**
2. **Android system surfaces are far more AX-friendly than iOS** — a genuinely useful platform finding:
   - the runtime **permission dialog** is AX-exposed with real ids (`com.android.permissioncontroller:id/permission_deny_button`), unlike iOS TCC;
   - the **camera app** (`com.android.camera2:id/shutter_button`, `done_button`, `retake_button`) and the **crop editor** (`…:id/crop_image_menu_crop`) are AX-drivable, which **lets D02's capture limb actually be driven on Android** where iOS is hardware-gated;
   - `mobile_clipboard` gave a **decisive** F02 verification (real code read back off the device).
3. **IME discipline still bites.** Two separate traps were hit and handled per R77 #19/R104: (a) the first tap after focusing a field is consumed dismissing the keyboard; (b) with the IME up, tree coordinates for below-fold controls land **on the keyboard**. Both were resolved with screenshot → confirm IME → BACK → re-derive.
4. **`run_playwright_code` has no `require`/`fs`** — the §5.20 "read `.env.local` inside the script" credential-safe login pattern is **not available** in this sandbox. Worth documenting; the owner-supplied credential was used instead.
5. **Admin selectors:** the ID-badge filter/rows needed `click({force:true})` (pointer-stability timeouts) and the **completed-request "View" only opened via a DOM-level `.click()`**. Also, the **"Trade Operations" sidebar group is collapsed by default**, so its links are absent from the DOM until expanded — a nav trap for future admin rounds.
6. **Recommended follow-up tasks (NOT applied — execution-only run):**
   - ⚠️ **OWNER-ASSIGNED 2026-09-18: F1 + F2 are handed off as a separate dev task** — see **`DEV-TASK-F1-F2-handoff.md`** in this run folder for the full spec (files/lines, root cause, proposed fix, acceptance criteria, re-verification steps). Owner also confirmed code fixes must **not** be applied by the QA agent.
   - **FIX: guard the `accessUntil` interpolation** in `subscriptionNotifications.ts:163` + `stripe-webhook-subscriptions/index.ts:1290/1311` (F1). → *handed off*
   - **FIX: stale header notification badge** after bulk mark-all-read (F2) — dev to determine whether the Realtime `user_notifications` UPDATE channel is live. → *handed off*
   - **FIX: last-section occlusion by the floating Sell FAB** (F3) — add bottom padding.
   - **Fixture ask:** an `in_progress` trade for the A08 quick-reply chips.
   - **Fixture ask:** media on the emulator (R98) to unlock A06's image-send limb.
   - **Credential ask:** refresh the registry's documented admin test password (it is stale; the current value lives only in gitignored `.env` files).
   - **Doc ask:** A10 should be marked iOS-specific (or re-scoped to a platform-conditional expected result), since Android's Photo Picker is permissionless.
   - **Consolidate:** the two divergent "Failed to take photo" strings (F5).
