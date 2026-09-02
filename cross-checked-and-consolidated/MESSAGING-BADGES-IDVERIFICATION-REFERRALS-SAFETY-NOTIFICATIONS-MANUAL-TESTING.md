# Messaging · Badges · ID Verification · Referrals · Safety · Notifications — Manual Testing Guide

**Source of truth:** `Prompts/Done/MODULE-07-MESSAGING.md` · `Prompts/Done/MODULE-08-BADGES-V2.md` · `Prompts/Done/MODULE-08-Badges & Achievements VERIFICATION-V2.md` · `Prompts/Done/MODULE-08-REVIEWS-RATINGS.md` · `Prompts/Done/MODULE-10-ID-BADGE-VERIFICATION-V2.md` · `Prompts/Done/MODULE-11-REFERRALS-V2.md` · `Prompts/Done/MODULE-13-SAFETY-COMPLIANCE.md` · `Prompts/Done/MODULE-14-NOTIFICATIONS-V2.md` · `docs/flow-registry.md`
**Flows covered:** FLOW-13 (Referrals) · FLOW-14 (Messaging/Realtime) · FLOW-15 (Safety & Moderation) · FLOW-16 (CPSC Recall Check) · FLOW-17 (Notifications) · FLOW-29 (ID Badge Submission & Decision Notifications) · Badges/Achievements & ID Verification (trust/reputation)
**Last updated:** 2026-09-02 (guide-currency audit v2: B05 Leaderboard = no in-app entry (deep-link/notification); C01 re-verify resolved; C05/C06 review copy corrected + Report Other added; Group J re-pointed to live NotificationPreferencesScreen; J05 marked NOT SUPPORTED)
**Scope:** End-user manual testing via app screens + admin portal screens (no SQL / no DB access required)
**Devices:** iOS Simulator + Android Emulator · Admin portal in browser

---

## Test Case Index

| Group | TC# | Description |
|---|---|---|
| **A — Messaging: Conversations & Chat** | MSG-TC-A01 | Conversation list (search, unread badges, empty state) |
| | MSG-TC-A02 | Open a chat thread + trade context banner |
| | MSG-TC-A03 | Send a text message + delivery status (sent→delivered→read) |
| | MSG-TC-A04 | Receive a message in real time |
| | MSG-TC-A05 | Typing indicator |
| | MSG-TC-A06 | Send an image message + full-screen viewer |
| | MSG-TC-A07 | Message length limit (2000 chars) |
| | MSG-TC-A08 | Quick-reply meeting chips |
| | MSG-TC-A09 | Safety meeting banner + Learn more |
| | MSG-TC-A10 | Photo permission denied error |
| **B — Badges & Achievements** | MSG-TC-B01 | My Badges grid (earned vs locked) |
| | MSG-TC-B02 | Badge detail modal |
| | MSG-TC-B03 | Badge showcase on profile |
| | MSG-TC-B04 | Badge celebration modal on unlock |
| | MSG-TC-B05 | Leaderboard ranking (no in-app entry — deep-link/notification only) |
| **C — Reviews & Ratings** | MSG-TC-C01 | Submit a post-trade review (stars + comment) |
| | MSG-TC-C02 | Rating required validation |
| | MSG-TC-C03 | Anonymous review |
| | MSG-TC-C04 | Skip review |
| | MSG-TC-C05 | Review display on seller profile + aggregate rating |
| | MSG-TC-C06 | Report a review (reviewee only) |
| **D — ID Badge Verification (End User)** | MSG-TC-D01 | Start ID verification + upload from library |
| | MSG-TC-D02 | Capture ID with camera |
| | MSG-TC-D03 | Submit creates pending request |
| | MSG-TC-D04 | Duplicate pending request blocked |
| | MSG-TC-D05 | No-image submit validation |
| | MSG-TC-D06 | Pending state screen |
| | MSG-TC-D07 | Approved → Verified badge on profile |
| | MSG-TC-D08 | Rejected → reason shown + resubmit |
| | MSG-TC-D09 | Submission confirmation notifications reach the user |
| | MSG-TC-D10 | Decision notifications honor channel preferences |
| **E — ID Badge Verification (Admin)** | MSG-TC-E01 | Review queue (stats, filters, search) |
| | MSG-TC-E02 | Approve a request |
| | MSG-TC-E03 | Reject with reason |
| | MSG-TC-E04 | View completed request details |
| | MSG-TC-E05 | Edit message templates |
| | MSG-TC-E06 | New submission creates admin alert notification |
| **F — Referrals** | MSG-TC-F01 | View referral code + hero |
| | MSG-TC-F02 | Copy referral code |
| | MSG-TC-F03 | Share referral code (native share) |
| | MSG-TC-F04 | Active rewards display |
| | MSG-TC-F05 | Referral history (pending vs completed) |
| | MSG-TC-F06 | Enter referral code at signup |
| | MSG-TC-F07 | Program paused banner + disabled share |
| | MSG-TC-F08 | Admin configures referral rewards |
| **G — Safety & Compliance (End User)** | MSG-TC-G01 | Listing flagged → Safety Review screen |
| | MSG-TC-G02 | Appeal a flagged/rejected listing |
| | MSG-TC-G03 | Resubmit a "needs edits" listing |
| | MSG-TC-G04 | Remove a flagged listing |
| | MSG-TC-G05 | Recall safety alert notification |
| | MSG-TC-G06 | Appeal max-attempt limit follows admin config |
| | MSG-TC-G07 | Appeal window follows admin config |
| | MSG-TC-G08 | AI moderation toggle affects automated image review |
| | MSG-TC-G09 | Recall check toggle and threshold affect recall flagging |
| **H — Safety & Compliance (Admin)** | MSG-TC-H01 | Flagged items moderation queue |
| | MSG-TC-H02 | Approve a flagged item |
| | MSG-TC-H03 | Reject with reason |
| | MSG-TC-H04 | Request edits |
| | MSG-TC-H05 | Trade dispute: mark under review |
| | MSG-TC-H06 | Trade dispute: resolve complete / refund |
| **I — Notifications: Permission & Center** | MSG-TC-I01 | Enable push notifications |
| | MSG-TC-I02 | Push error states (Expo Go / web) |
| | MSG-TC-I03 | Notification center list + icons |
| | MSG-TC-I04 | Tap notification → deep link + mark read |
| | MSG-TC-I05 | Mark all as read |
| | MSG-TC-I06 | Pagination + pull to refresh |
| | MSG-TC-I07 | Real-time arrival |
| **J — Notification Preferences** | MSG-TC-J01 | Category × channel toggles (live screen — 5 categories, no Safety) |
| | MSG-TC-J02 | Default preferences (DB-driven, no hardcoded defaults) |
| | MSG-TC-J03 | Always-on note (live footer copy) |
| | MSG-TC-J04 | Quiet hours (subscriber) + validation |
| | MSG-TC-J05 | 🚫 NOT SUPPORTED — ID verification preference category (none exists) |

---

## Pre-conditions (set up before testing)

- The app is installed and running on an iOS Simulator and/or Android Emulator pointed at staging. (Push notifications require a development build — not Expo Go — to fully test delivery.)
- The admin portal is reachable in a browser and you can log in as an admin.
- Two test users exist who can chat: a buyer and a seller, each in the same active node, with an in-progress trade so a chat thread exists.
- At least one user has earned 1+ badges, and at least one completed trade exists so a review can be left.
- For ID verification: a valid ID photo (or any test image) is available on the device.
- For ID verification notification tests: a device build can receive push notifications, email inbox access exists for the test user, and admin notifications are visible in the admin portal.
- For referrals: a referral-enabled account with a code, and the admin referral configuration is reachable.
- For safety: a listing that can be flagged (e.g., a title matching a known recall keyword), or admin access to set an item to flagged/rejected/needs-edits.

## Accounts for testing

| Account | Role / tier | Notes |
|---|---|---|
| test-buyer | Kids Club+ subscriber | Has an in-progress trade + chat with test-seller |
| test-seller | Kids Club+ subscriber | Owns the listing being traded; phone verified |
| test-reviewer | Any tier | Completed a trade; used for reviews |
| test-referrer | Referral-enabled | Has a referral code to share |
| new-user | Fresh email | Enters a referral code at signup; submits ID verification |
| admin | Admin portal | ID badge review, item moderation, disputes, referral config |

> All tests are screen-driven. No SQL or direct database access is required.
> Features noted as **Deferred** below are documented but not yet surfaced in the app; they are flagged so testers do not treat their absence as a defect.

---

## Group A — Messaging: Conversations & Chat

### MSG-TC-A01 · Conversation list

**Actors:** test-buyer

**Objective:** Verify the Messages list shows conversations with search, unread badges, and an empty state.

**Steps:**
1. Open the **Messages** tab.
2. Use the **Search conversations** field to search by a partner name, listing title, or message text.
3. (If no conversations) observe the empty state.

**Expected Result:**
- The header reads "Messages"; each row shows the partner (with a green ShieldCheck if verified), a trade context chip "[Title] • $[Price]", the last message preview (bold if unread), and a relative timestamp.
- Unread conversations show a green count badge (capped at "9+").
- A no-result search shows "No matches found" / "Try a different search term"; a truly empty inbox shows "No messages yet" / "Start a trade and chat with other users!" with a **Browse Items** button.

### MSG-TC-A02 · Open a chat thread + trade context banner

**Actors:** test-buyer

**Objective:** Verify the chat thread header and trade context.

**Steps:**
1. Tap a conversation to open the chat thread.

**Expected Result:**
- The header shows the partner avatar/name (with verified icon if applicable) and the listing title.
- A trade context banner shows the item thumbnail, "[Title] • $[Price]", and a **View Trade** link that opens the listing/trade detail.

### MSG-TC-A03 · Send a text message + delivery status

**Actors:** test-buyer, test-seller

**Objective:** Verify sending a message and the delivery-status progression.

**Steps:**
1. As **test-buyer**, type a message in "Type a message..." and tap the green send (paper plane) button.
2. Observe the status indicator under your message.
3. Have **test-seller** open the same chat and view the message.

**Expected Result:**
- The message appears right-aligned in a green bubble; a single gray check (sent) shows immediately, then a double gray check (delivered) once received, then a green double check (read) after the recipient views it (~3s in-chat).
- The send button is only visible when text is entered and is disabled while sending.

### MSG-TC-A04 · Receive a message in real time

**Actors:** test-buyer, test-seller

**Objective:** Verify real-time receipt without manual refresh.

**Steps:**
1. With both users in the chat, have **test-seller** send a message.

**Expected Result:**
- The message appears in **test-buyer**'s thread in real time (left-aligned gray bubble) without refreshing.

### MSG-TC-A05 · Typing indicator

**Actors:** test-buyer, test-seller

**Objective:** Verify the typing indicator appears and clears.

**Steps:**
1. Have **test-seller** start typing in the chat input.
2. Have them stop typing and wait a few seconds.

**Expected Result:**
- An animated three-dot bubble appears in **test-buyer**'s thread while the partner types and disappears ~3 seconds after they stop.

### MSG-TC-A06 · Send an image message + full-screen viewer

**Actors:** test-buyer

**Objective:** Verify image messages send and open full screen.

**Steps:**
1. Tap the paperclip icon and choose a photo.
2. After it sends, tap the image in the bubble.

**Expected Result:**
- A spinner shows during upload, then the image appears in the bubble; tapping it opens a full-screen viewer with swipe navigation.
- An upload failure shows an "Error" / "Failed to upload image" alert.

### MSG-TC-A07 · Message length limit

**Actors:** test-buyer

**Objective:** Verify the 2000-character limit.

**Steps:**
1. Paste or type more than 2000 characters into the message field.

**Expected Result:**
- Input is capped at 2000 characters with a notice that the message was truncated to 2000 characters.

### MSG-TC-A08 · Quick-reply meeting chips

**Actors:** test-buyer

**Objective:** Verify the safe-meeting quick replies.

**Steps:**
1. Focus the message input and tap a quick-reply chip (e.g., "📍 Public place only").

**Expected Result:**
- The chip text is inserted/sent as a message; chips include: "📅 Available today", "📆 Available tomorrow", "🗓 Suggest times", "📍 Public place only", "⏰ Running late" (with a "+ More" expander).

### MSG-TC-A09 · Safety meeting banner + modal

**Actors:** test-buyer

**Objective:** Verify the safety banner appears with guidance.

**Steps:**
1. Open a chat for a listing for the first time and read the banner.
2. Tap the banner.

**Expected Result:**
- A banner shows "Trade Smart, Trade Safe" (shown once per listing); tapping it opens a safety modal titled "Trade Smart, Trade Safe" with a "Got it — Let's Trade Safely" button.

### MSG-TC-A10 · Photo permission denied error

**Actors:** test-buyer

**Objective:** Verify photo-permission denial is handled.

**Steps:**
1. Deny photo-library permission, then tap the paperclip to attach an image.

**Expected Result:**
- A "Permission Required" alert explains photo-library access is needed to share images; no crash occurs.

> **Deferred (documented, not yet in UI):** in-chat report-message / report-user, block-user, automatic contact-info blocking, and profanity filtering are not surfaced in the current chat UI — do not treat their absence as a defect.

---

## Group B — Badges & Achievements

### MSG-TC-B01 · My Badges grid

**Actors:** test-buyer

**Objective:** Verify earned vs locked badges render.

**Steps:**
1. From Profile, open **My Badges**.

**Expected Result:**
- A 3-column grid shows badges; earned badges have a highlighted (yellow) background and locked ones appear dimmed.

### MSG-TC-B02 · Badge detail modal

**Actors:** test-buyer

**Objective:** Verify the badge detail modal.

**Steps:**
1. Tap an earned badge, then a locked badge.

**Expected Result:**
- The modal shows the badge name and description; an earned badge shows "Unlocked: {date}", a locked one shows a lock icon and encouragement to keep going. **Close** dismisses it.

### MSG-TC-B03 · Badge showcase on profile

**Actors:** test-buyer

**Objective:** Verify the profile badge showcase.

**Steps:**
1. Open your own Profile and find the "My Badges (N)" section; tap it.

**Expected Result:**
- A horizontal strip of earned badges is shown with a count; with zero badges it reads "No badges earned yet. Start trading to earn badges." Tapping navigates to My Badges.

### MSG-TC-B04 · Badge celebration modal on unlock

**Actors:** test-buyer

**Precondition:** Perform an action that earns a new badge (e.g., complete a qualifying trade), or QA triggers a badge award.

**Objective:** Verify the unlock celebration.

**Steps:**
1. Earn a new badge while on/returning to the Profile screen.

**Expected Result:**
- A celebration modal appears: "🎉 New Badge Earned! 🎉" with the badge icon, name, description, confetti animation, and an **Awesome!** button to close.

### MSG-TC-B05 · Leaderboard ranking — 🔎 no in-app entry (deep-link/notification only)

> 🔄 **Rewritten 2026-09-02 (guide-currency audit):** the `LeaderboardScreen` exists and is registered (route `Leaderboard`), but there is **no `navigate('Leaderboard')` caller anywhere in `src`** — there is no static in-app menu/tap entry. The only ways to reach it are tapping a `leaderboard_rank_up` notification or the `/leaderboard` deep link (`src/services/deepLink.ts`). The previous guide step ("Open the Leaderboard screen") implied a static entry that does not exist.

**Actors:** test-buyer

**Objective:** Verify the leaderboard (reached via its notification/deep-link entry).

**Steps:**
1. Reach the **Leaderboard** screen by tapping a `leaderboard_rank_up` notification or opening the `/leaderboard` deep link (there is no other in-app entry).
2. Pull to refresh.

**Expected Result:**
- The screen titled "Leaderboard" lists top traders by badge count with medals (🥇/🥈/🥉) and rank/name/badge count; an empty data set shows "No Badges Yet".
- **Reachability flag:** because there is no static in-app entry, this case is effectively **deep-link/notification-gated** — if no `leaderboard_rank_up` notification is available, drive it via the `/leaderboard` deep link.

---

## Group C — Reviews & Ratings

### MSG-TC-C01 · Submit a post-trade review

> ✅ **Re-verify resolved 2026-09-02 (guide-currency audit):** the success copy `Alert('Success','Your review has been submitted!')` **exists** in `src/screens/review/SubmitReviewScreen.tsx` L106 — the earlier 2026-08-12 "string not found" caveat is cleared.

**Actors:** test-reviewer

**Precondition:** A completed trade exists with a counterparty to review.

**Objective:** Verify submitting a star rating + comment.

**Steps:**
1. After trade completion, open the **Review {name}** screen.
2. Tap a star to set a rating (1–5).
3. Enter an optional comment and tap **Submit Review**.

**Expected Result:**
- Stars fill gold up to the selected rating; the comment shows a live "{count}/500 characters"; on submit a success alert "Your review has been submitted!" appears.

### MSG-TC-C02 · Rating required validation

**Actors:** test-reviewer

**Objective:** Verify a rating is mandatory.

**Steps:**
1. On the review screen, tap **Submit Review** without selecting a star.

**Expected Result:**
- "Rating Required. Please select a star rating before submitting." appears and submission is blocked.

### MSG-TC-C03 · Anonymous review

**Actors:** test-reviewer

**Objective:** Verify the anonymous option.

**Steps:**
1. Enable **Post anonymously**, set a rating, and submit.

**Expected Result:**
- The review submits and later displays as "Anonymous User" with no avatar/profile link.

### MSG-TC-C04 · Skip review

**Actors:** test-reviewer

**Objective:** Verify the review can be skipped.

**Steps:**
1. On the review screen, tap **Skip for Now**.

**Expected Result:**
- The review flow is dismissed without submitting.

### MSG-TC-C05 · Review display on seller profile

> 🔄 **Rewritten 2026-09-02 (guide-currency audit):** `SellerProfileScreen` shows a **star row + numeric average + `(N reviews)`** and a section header **`Reviews (N)`** plus `No ratings yet`/`No reviews yet` (L299–469). The literal strings `"Average Rating: {x}/5"` and `"Total Reviews: {n}"` in the previous guide text **do not exist**.

**Actors:** test-buyer

**Objective:** Verify reviews and aggregate rating display.

**Steps:**
1. Open a seller's profile and view the rating section and review list.

**Expected Result:**
- The profile shows a star row with a numeric average and a `(N reviews)` count (or "No ratings yet"/"No reviews yet" when empty), and a section header `Reviews (N)`.
- Each review card shows reviewer, stars, date, and comment.

### MSG-TC-C06 · Report a review

> 🔄 **Rewritten 2026-09-02 (guide-currency audit):** the report actions now include a **4th option `Report Other`** (`review-report-other`, `ReviewCard.tsx` L154), and the success copy is now `Alert('Success','Review reported. Thank you!')` (L81) — changed 2026-08-31 per TRD-TC-Q15 / DEV-TASK-75. The previous guide's "Thank you for reporting. We will review this content." string is obsolete.

**Actors:** test-seller (reviewee)

**Objective:** Verify a reviewee can report a review.

**Steps:**
1. As the reviewee, open a review card's ⋯ menu and choose "Report as Spam" / "Report as Offensive" / "Report False Information" / "Report Other".
2. Confirm.

**Expected Result:**
- A confirmation appears and the success copy reads **"Review reported. Thank you!"**.

**Locator hints:**
- Review card ⋯ menu → `review-menu-button` · report actions → `review-report-spam` / `review-report-offensive` / `review-report-false-info` / `review-report-other` (ReviewCard report menu instrumented 2026-08-15; 4th `Report Other` added 2026-08-31).
- Report confirmation is native `Alert.alert` — dialog locator: N/A — see Dependencies.

**Dependencies:**
- Native `Alert.alert` (report confirmation) — match 'Confirm' / 'Cancel' by text; assert success "Review reported. Thank you!".

---

## Group D — ID Badge Verification (End User)

### MSG-TC-D01 · Start ID verification + upload from library

**Actors:** new-user

**Objective:** Verify the upload entry point and image selection.

**Steps:**
1. From Profile open **ID Verification**.
2. Tap **Tap to upload ID photo** and select an image; observe the preview.

**Expected Result:**
- The initial state shows "Verify Your Identity" with the privacy disclaimer ("We will not store your ID image. It will be deleted after verification."), a **Use Camera** option, and a submit button (default "Submit for Verification") with tips about a clear, well-lit, in-focus photo. The selected image previews with a **Change Image** option.

### MSG-TC-D02 · Capture ID with camera

**Actors:** new-user

**Objective:** Verify camera capture.

**Steps:**
1. Tap **Use Camera**, grant permission, and capture an ID photo.

**Expected Result:**
- The captured image becomes the preview. If camera permission is denied, a "Permission Required. Please allow camera access." alert appears.

### MSG-TC-D03 · Submit creates a pending request

**Actors:** new-user

**Objective:** Verify submission creates a pending request.

**Steps:**
1. With an image selected, tap the submit button.

**Expected Result:**
- A "Submitted Successfully" message confirms the request will be reviewed (within ~24 hours), and the screen moves to the pending state.

### MSG-TC-D04 · Duplicate pending request blocked

**Actors:** new-user

**Objective:** Verify only one pending request is allowed.

**Steps:**
1. With a pending request already open, return to ID Verification and attempt to submit again.

**Expected Result:**
- "Pending Request. You already have a pending verification request. Please wait for the admin to review it." appears and no second request is created.

### MSG-TC-D05 · No-image submit validation

**Actors:** new-user

**Objective:** Verify the no-image guard.

**Steps:**
1. On the upload screen, tap submit without selecting an image.

**Expected Result:**
- "Please select an image" appears and nothing is submitted.

### MSG-TC-D06 · Pending state screen

**Actors:** new-user

**Objective:** Verify the pending state display.

**Steps:**
1. Open ID Verification while a request is pending.

**Expected Result:**
- A clock icon with "Verification Pending", "We'll review your ID within 24–48 hours", an "Under Review" pill, and a **Back to Profile** button are shown.

### MSG-TC-D07 · Approved → Verified badge on profile

**Actors:** new-user, admin

**Objective:** Verify approval grants the Verified badge.

**Steps:**
1. Have the **admin** approve the request (see MSG-TC-E02).
2. As **new-user**, reopen ID Verification and view your seller/public profile.

**Expected Result:**
- The screen shows "Identity Verified" with a green "Verified ✓" pill; the public profile header shows a ShieldCheck "Verified" indicator.

### MSG-TC-D08 · Rejected → reason shown + resubmit

**Actors:** new-user, admin

**Objective:** Verify rejection messaging and resubmission.

**Steps:**
1. Have the **admin** reject the request with a reason (see MSG-TC-E03).
2. As **new-user**, view the notification/result and resubmit a new photo.

**Expected Result:**
- The user is notified the verification was not approved with the reason (and any admin notes); the user can submit a new request.

### MSG-TC-D09 · Submission confirmation notifications reach the user

**Actors:** new-user

**Objective:** Verify submitting ID verification sends the expected confirmation notifications.

**Steps:**
1. As **new-user**, submit a new ID verification request.
2. Open the in-app notification center.
3. Check the test email inbox for the same user.

**Expected Result:**
- The user receives an in-app confirmation notification for the submission.
- A confirmation email arrives with the review SLA messaging.
- The notification content refers to the ID verification submission, not a generic system event.

### MSG-TC-D10 · Decision notifications honor channel preferences

**Actors:** new-user, admin

**Objective:** Verify approval/rejection notifications follow the user's channel preferences for ID verification.

**Steps:**
1. As **new-user**, set the ID verification notification category so one channel is disabled and another remains enabled.
2. As **admin**, approve or reject the pending request.
3. Check the enabled and disabled channels.

**Expected Result:**
- The enabled channels receive the decision notification.
- Disabled channels do not receive the decision notification.
- The delivered message includes the decision-specific content such as approval copy or the rejection reason.

---

## Group E — ID Badge Verification (Admin)

### MSG-TC-E01 · Review queue

**Actors:** admin

**Objective:** Verify the ID badge queue, stats, filters, and search.

**Steps:**
1. In the admin portal open **ID Badge Verification → Verification Queue**.
2. Use the status filters (All / Pending / Approved / Rejected) and search by name or email.

**Expected Result:**
- Stats cards show Pending Review, Approved, Rejected, and Avg Review Time.
- The table lists User / Email / Phone / Node / Submitted / Status / Actions, with color-coded status badges; pending rows show **Review**, completed rows show **View**.

### MSG-TC-E02 · Approve a request

**Actors:** admin

**Objective:** Verify approval.

**Steps:**
1. Open a pending request via **Review**, view the submitted screenshot, select **Approve**, add optional notes, and submit.

**Expected Result:**
- A success message shows and the admin returns to the queue; the badge is awarded and the user is notified (push + in-app + email). The stored screenshot is removed after the decision.

### MSG-TC-E03 · Reject with reason

**Actors:** admin

**Objective:** Verify rejection requires a reason.

**Steps:**
1. On a pending request, select **Reject**, attempt to submit without a reason, then choose a reason (e.g., "Unclear photo", "ID expired", "Name does not match profile", "Multiple IDs in photo", "Not a government-issued ID", "Other"), add optional notes, and submit.

**Expected Result:**
- Submitting without a reason shows "Please select a rejection reason"; after a reason is chosen the rejection saves, the user is notified with the reason/notes, and the screenshot is deleted.

### MSG-TC-E04 · View completed request details

**Actors:** admin

**Objective:** Verify read-only details for completed requests.

**Steps:**
1. On a completed request tap **View**.

**Expected Result:**
- The details page shows user info, status, submitted/reviewed timestamps, and the decision (rejection reason + notes or approval notes), read-only.

### MSG-TC-E05 · Edit message templates

**Actors:** admin

**Objective:** Verify template editing.

**Steps:**
1. Open the **Message Templates** tab, tap **Edit** on a message, change the text (using variables like `{first_name}`), and **Save**.

**Expected Result:**
- A "Message saved" confirmation appears and the updated copy is used for users.

### MSG-TC-E06 · New submission creates admin alert notification

**Actors:** admin, new-user

**Objective:** Verify admins are alerted when a new ID verification request is submitted.

**Steps:**
1. As **new-user**, submit a fresh ID verification request.
2. As **admin**, review the admin notifications area and the ID badge queue.

**Expected Result:**
- An admin alert notification is created for the new submission.
- The notification links to the ID badge review queue or request detail.
- The request is visible in the pending queue without needing a manual refresh loop beyond the normal refresh behavior.

---

## Group F — Referrals

### MSG-TC-F01 · View referral code + hero

**Actors:** test-referrer

**Objective:** Verify the referrals screen.

**Steps:**
1. Open the **Referrals** screen.

**Expected Result:**
- A hero shows a gift icon, "Refer Friends, Earn SP", and "Share your code and get rewards when they join."; the 8-character code is shown in a code box; an SP-earned strip reads "You've earned {X} SP from referrals".

### MSG-TC-F02 · Copy referral code

**Actors:** test-referrer

**Objective:** Verify copy to clipboard.

**Steps:**
1. Tap the copy icon next to the code.

**Expected Result:**
- A "Copied!" confirmation ("Referral code copied to clipboard") appears.

### MSG-TC-F03 · Share referral code

**Actors:** test-referrer

**Objective:** Verify native share.

**Steps:**
1. Tap **Share**.

**Expected Result:**
- The native share sheet opens with a message containing the code and link (and dynamic bonus text when trade/listing bonuses are enabled).

### MSG-TC-F04 · Active rewards display

**Actors:** test-referrer

**Objective:** Verify the rewards card.

**Steps:**
1. On the Referrals screen, review the active rewards section.

**Expected Result:**
- It lists the friend's bonuses (e.g., "First Trade Bonus +{X} SP when they complete their first trade", "First Listing Bonus +{X} SP when their first listing is approved") and the referrer's earn amounts, shown only when at least one bonus is enabled (otherwise a "No active referral programs" card).

### MSG-TC-F05 · Referral history

**Actors:** test-referrer

**Objective:** Verify referral history states.

**Steps:**
1. Scroll to **Referral History**.

**Expected Result:**
- Each row shows the referred user, join date, status, and reward; pending referrals show a grayed reward with no check, completed referrals show a green check and colored reward. With none, "No referrals yet — share your code!" is shown.

### MSG-TC-F06 · Enter referral code at signup

**Actors:** new-user

**Objective:** Verify referral entry during signup.

**Steps:**
1. On **Create Account**, enter the referrer's 8-character code and complete signup; in a separate run enter an invalid code.

**Expected Result:**
- A valid code is accepted and the referral is created in pending status; an invalid code prompts "Invalid Referral Code … Would you like to fix it or continue without a code?" with **Fix it** / **Continue anyway**.

### MSG-TC-F07 · Program paused banner + disabled share

**Actors:** test-referrer, admin

**Precondition:** Admin sets the referral program to paused.

**Objective:** Verify paused-program messaging.

**Steps:**
1. With the program paused, open the Referrals screen.

**Expected Result:**
- A banner reads "Referral program is paused globally right now. Rewards shown below are configured but currently not being awarded." and the **Share** button is disabled.

### MSG-TC-F08 · Admin configures referral rewards

**Actors:** admin

**Objective:** Verify reward configuration.

**Steps:**
1. In the admin portal open **Referrals → Configuration**.
2. Change the First Trade and First Listing referrer/referee SP amounts and **Save** each.

**Expected Result:**
- Values validate as integers ≥ 0; each save shows "Successfully updated {key}"; the new amounts reflect on the end-user Referrals screen.

> **Deferred (documented, not fully enforced in UI):** subscriber-gating of referral incentives — config exists but there is no explicit gating message on the Referrals screen.

---

## Group G — Safety & Compliance (End User)

### MSG-TC-G01 · Listing flagged → Safety Review screen

**Actors:** test-seller, admin

**Precondition:** A listing has been flagged/rejected/needs-edits (via recall match or admin action).

**Objective:** Verify the Safety Review screen.

**Steps:**
1. As **test-seller**, open the flagged listing's **Safety Review** screen.

**Expected Result:**
- A "Safety Review" header with a red ShieldWarning icon shows a status-specific message ("This listing is currently under safety review." / "This listing was rejected by our safety team." / "This listing needs edits before it can be approved."), a read-only listing preview, and the admin note/rejection reason.

### MSG-TC-G02 · Appeal a flagged/rejected listing

**Actors:** test-seller

**Objective:** Verify the appeal flow and validation.

**Steps:**
1. On the Safety Review screen tap **Appeal**.
2. Submit with an empty reason, then with under 10 characters, then with a valid explanation.

**Expected Result:**
- Empty shows "Please explain why you are appealing this decision."; under 10 chars shows the minimum-length message; a valid appeal shows "Appeal Submitted — Your listing is back under review." (appeals are limited to the configured max).

### MSG-TC-G03 · Resubmit a "needs edits" listing

**Actors:** test-seller

**Objective:** Verify resubmission for needs-edits.

**Steps:**
1. On a listing with status "needs edits", use the resubmit action after addressing notes.

**Expected Result:**
- The listing returns to the moderation queue for re-review.

### MSG-TC-G04 · Remove a flagged listing

**Actors:** test-seller

**Objective:** Verify removal.

**Steps:**
1. On the Safety Review screen tap **Remove Listing** and confirm.

**Expected Result:**
- A confirmation modal appears; confirming removes the listing.

### MSG-TC-G05 · Recall safety alert notification

> ⚠️ **Needs re-verification (2026-08-12):** The term "Recall Alert" was not found in the UI source; the notification may use different wording (e.g., "Safety Alert"). Verify the actual title.

**Actors:** test-seller

**Precondition:** A listing matches a CPSC recall keyword (QA may use a known recall title).

**Objective:** Verify a recall produces a safety alert.

**Steps:**
1. Create/own a listing whose title/description matches a recalled product and check notifications.

**Expected Result:**
- A "Safety Alert" notification (red) is delivered indicating a recalled item was detected, and the listing surfaces the safety-review banner.

### MSG-TC-G06 · Appeal max-attempt limit follows admin config

**Actors:** test-admin, test-seller

**Precondition:** A rejected/needs-edits listing exists and is still within the appeal window.

**Objective:** Verify `moderation_appeal_max_attempts` limits additional appeals.

**Steps:**
1. As **test-admin**, open **/config**, set `moderation_appeal_max_attempts` to `1`, and save.
2. As **test-seller**, submit one valid appeal on the Safety Review screen.
3. After the listing is returned to a rejected/needs-edits state again, try to submit a second appeal.

**Expected Result:**
- The first appeal is accepted.
- The second attempt is blocked with a limit-reached message, or the **Appeal** CTA is disabled/hidden once the configured max is exhausted.

### MSG-TC-G07 · Appeal window follows admin config

**Actors:** test-admin, test-seller

**Objective:** Verify `moderation_appeal_window_days` controls how long appeals stay available.

**Steps:**
1. As **test-admin**, set `moderation_appeal_window_days` to `1` and save.
2. Open a rejection that is older than 24 hours and compare it to a fresh rejection that is less than 24 hours old.

**Expected Result:**
- Older rejections no longer allow appeal and show a window-expired state (or hide the CTA entirely).
- Fresh rejections within the configured window can still be appealed.

### MSG-TC-G08 · AI moderation toggle affects automated image review

**Actors:** test-admin, test-seller

**Precondition:** QA has an image fixture that consistently triggers automated image moderation when AI moderation is enabled.

**Objective:** Verify `moderation_ai_enabled` controls the automated image-moderation path.

**Steps:**
1. As **test-admin**, set `moderation_ai_enabled` to `true`.
2. As **test-seller**, create a listing with the flagged image fixture and record the result.
3. Set `moderation_ai_enabled` to `false` and create the same listing again with the same image.

**Expected Result:**
- With AI moderation enabled, the listing is auto-flagged or routed into safety review from image moderation.
- With AI moderation disabled, the same image no longer triggers the automated AI moderation path; any manual/admin moderation remains separate.

### MSG-TC-G09 · Recall check toggle and threshold affect recall flagging

**Actors:** test-admin, test-seller

**Precondition:** QA has a known recalled-product fixture and, if available, a borderline-match fixture.

**Objective:** Verify `cpsc_recall_check_enabled` and `cpsc_match_threshold` control automated recall detection.

**Steps:**
1. As **test-admin**, set `cpsc_recall_check_enabled` to `false` and create a listing using the known recalled-product fixture.
2. Re-enable recall checking and create the same listing again.
3. If a borderline fixture is available, lower `cpsc_match_threshold` and repeat.

**Expected Result:**
- With recall checking disabled, no automated recall alert/banner is generated for the exact recall fixture.
- With recall checking enabled, the exact recall fixture generates the safety alert and review banner.
- Lowering the threshold makes borderline fixtures flag more aggressively; raising it reduces false positives.

---

## Group H — Safety & Compliance (Admin)

### MSG-TC-H01 · Flagged items moderation queue

**Actors:** admin

**Objective:** Verify the flagged-items queue.

**Steps:**
1. In the admin portal open the **Flagged Items** page and filter by All / Flagged / Rejected / Needs Edits.

**Expected Result:**
- The list shows item title, color-coded status badge, seller, flagged date, and appeal count; selecting an item shows full details (images, description, seller, rejection reason, appeal history).

### MSG-TC-H02 · Approve a flagged item

**Actors:** admin

**Objective:** Verify approval makes an item available.

**Steps:**
1. Open a flagged item and tap **Approve**; confirm.

**Expected Result:**
- The item status becomes available/public and the seller is notified.

### MSG-TC-H03 · Reject with reason

**Actors:** admin

**Objective:** Verify rejection requires a reason.

**Steps:**
1. Tap **Reject**, attempt to confirm without a reason, then enter a reason and confirm.

**Expected Result:**
- Without a reason "Please provide a rejection reason" appears; with a reason the item is rejected and the seller is notified.

### MSG-TC-H04 · Request edits

**Actors:** admin

**Objective:** Verify the request-edits action.

**Steps:**
1. Tap **Request Edits**, add notes, and confirm.

**Expected Result:**
- The item moves to "needs edits" and the seller is notified with the notes.

### MSG-TC-H05 · Trade dispute: mark under review

**Actors:** admin

**Precondition:** A buyer has reported a trade (dispute status "reported").

**Objective:** Verify a dispute can be moved to under review.

**Steps:**
1. Open the dispute detail page and tap **Mark Under Review**; confirm.

**Expected Result:**
- The trade summary shows the buyer's reported issue (reason + notes + timestamp) and the dispute status changes to under review.

### MSG-TC-H06 · Trade dispute: resolve complete / refund

**Actors:** admin

**Objective:** Verify dispute resolution paths.

**Steps:**
1. On a dispute, tap **Resolve → Complete** and read the confirmation; in a separate dispute tap **Resolve → Refund Buyer** and read the confirmation.

**Expected Result:**
- Resolve Complete explains the trade is marked complete and seller payout proceeds; Resolve Refund warns the buyer is refunded, seller payout is cancelled, and the action cannot be undone. Confirming applies the chosen outcome.

> **Deferred (documented, not yet in UI):** a user-facing "Report Item" button on listings and an in-app prohibited-items list during listing creation are not present — recall checks run server-side after submission.

---

## Group I — Notifications: Permission & Center

### MSG-TC-I01 · Enable push notifications

**Actors:** new-user

**Objective:** Verify the push permission flow.

**Steps:**
1. Open the notification setup prompt and tap **Enable Notifications**; grant permission.

**Expected Result:**
- The prompt shows "🔔 Stay Connected" with benefit bullets; while requesting it shows "Setting up notifications...", then "✅ Notifications enabled!" and a confirming local notification ("Notifications Enabled").

### MSG-TC-I02 · Push error states

**Actors:** new-user

**Objective:** Verify error messaging when push can't initialize.

**Steps:**
1. Attempt to enable push in Expo Go (or on web).

**Expected Result:**
- A clear device-specific message appears (e.g., web: "Push notifications are not available on web"; Android: guidance to use a development build with google-services.json), with no crash.

### MSG-TC-I03 · Notification center list + icons

**Actors:** test-buyer

**Objective:** Verify the notification list rendering.

**Steps:**
1. Open the **Notifications** center.

**Expected Result:**
- The list (titled "Notifications") shows each item with a type-specific icon/color, a title (bold if unread), body, and relative time; unread rows have a distinct background.

### MSG-TC-I04 · Tap notification → deep link + mark read

**Actors:** test-buyer

**Objective:** Verify deep-linking and read state.

**Steps:**
1. Tap a trade notification, then a message notification, then a subscription/SP/ID notification.

**Expected Result:**
- Each navigates to the relevant destination (Trade detail, Chat, Subscription, Wallet, or ID Verification respectively); the tapped notification becomes read (title regular weight).

### MSG-TC-I05 · Mark all as read

**Actors:** test-buyer

**Objective:** Verify bulk read.

**Steps:**
1. With several unread notifications, use **Mark all as read**.

**Expected Result:**
- All notifications become read and the unread count clears.

### MSG-TC-I06 · Pagination + pull to refresh

**Actors:** test-buyer

**Objective:** Verify pagination and refresh.

**Steps:**
1. Scroll to the bottom of a long notification list; then pull to refresh at the top.

**Expected Result:**
- More notifications load (≈20 per page) on reaching the end; pull-to-refresh reloads the list.

### MSG-TC-I07 · Real-time arrival

**Actors:** test-buyer, test-seller

**Objective:** Verify notifications arrive in real time.

**Steps:**
1. With **test-buyer** on the notification center, have **test-seller** trigger an event (e.g., send a trade message or accept a trade).

**Expected Result:**
- A new notification appears in the center in real time without manual refresh.

---

## Group J — Notification Preferences

> 🔄 **Group rewritten 2026-09-02 (guide-currency audit):** the notification-preferences screen the previous text described (`src/screens/notifications/NotificationSettingsScreen.tsx` — `Trade Updates`, `Safety Alerts`, `DEFAULT_PREFS`) is **unregistered and has zero live callers** (only its own unit test imports it). The **live, reachable screen** is `src/screens/profile/NotificationPreferencesScreen.tsx` (route `NotificationPreferences`, entered from Settings → Notifications row). Its category set is: **Subscription & Membership · Swap Points Events · Badges & Achievements · Trades & Transactions · System Updates** (`NotificationCategory` = `subscription|sp_events|badges|trades|system`, `src/services/notificationPreferences.ts` L7). There is **no `Safety Alerts` toggleable category and no `id_verification` category**. Preferences load from the DB (`getNotificationPreferences`).

### MSG-TC-J01 · Category × channel toggles (live screen)

**Actors:** test-buyer

**Objective:** Verify per-category channel toggles on the live Notification Preferences screen.

**Steps:**
1. Open **Notification Preferences** (Settings → Notifications) and toggle Push / In-App / Email for a category (e.g., Trades & Transactions).

**Expected Result:**
- Five categories render: **Subscription & Membership · Swap Points Events · Badges & Achievements · Trades & Transactions · System Updates**.
- Each category exposes Push / In-App / Email toggles (`toggle-<cat>-push|in_app|email`) that update optimistically and persist.
- **Note:** there is **no `Safety Alerts` category** in the live UI (the old `Trade Updates`/`Safety Alerts` taxonomy is gone — see J03 for the always-on safety note).

### MSG-TC-J02 · Default preferences (DB-driven)

**Actors:** new-user

**Objective:** Verify the initial channel settings come from the seeded DB preferences (there is no hardcoded defaults screen to assert).

**Steps:**
1. As a fresh user, open **Notification Preferences** and review the initial toggle state.
2. Cross-check against the seeded `notification_preferences` row (or re-run the seed) to confirm the defaults the app loaded.

**Expected Result:**
- The screen reflects the DB-loaded preferences (the five live categories above); there are no user-editable toggles for a Safety category (see J03).
- Assert against the seeded DB rows rather than a fixed default table, since the old `DEFAULT_PREFS` (with Safety) belongs to the dead screen.

### MSG-TC-J03 · Safety/always-on note (live footer copy)

**Actors:** test-buyer

**Objective:** Verify the always-on note on the live screen.

**Steps:**
1. Scroll to the footer of the Notification Preferences screen.

**Expected Result:**
- The footer reads **"Critical system alerts and safety notifications cannot be disabled."** (`NotificationPreferencesScreen.tsx` L421).
- **Note:** the previous guide sentence about "product recalls" being always delivered lives only in the dead `NotificationSettingsScreen` L184 — the live copy uses the wording above (semantics preserved: critical/safety alerts cannot be turned off).

### MSG-TC-J04 · Quiet hours (subscriber) + validation

**Actors:** test-buyer (subscriber)

**Objective:** Verify quiet hours and time validation.

**Steps:**
1. Open **Notification Preferences**, enable **Quiet Hours**, enter Start/End times, try an invalid value (e.g., "9pm"), then a valid 24-hour value (e.g., "22:00"), and **Save Quiet Hours**.

**Expected Result:**
- An invalid format shows "Invalid time format. Please use 24-hour format: HH:MM (example: 22:00)."; a valid value saves successfully.

### MSG-TC-J05 · ID verification preference controls decision delivery — 🚫 NOT SUPPORTED (no such category)

> 🚫 **Dead premise (2026-09-02, guide-currency audit):** there is **no `id_verification` notification-preference category** in the live UI or in the `NotificationCategory` type union (`notificationPreferences.ts` L7). The premise of this case (a category or "equivalent verification-notification controls" on the settings screen) is unsupported in the live app, so it **cannot be executed as written**. ID-verification *type* notifications do still appear in the Notification Center (`id_verification_*` icon map), but there is no per-category preference for them.

**Actors:** n/a (feature absent)

**Objective:** (Recorded only.) If/when an ID-verification preference category is added, verify per-channel control of decision-notification delivery.

**Status:** 🚫 **NOT SUPPORTED — do not run.** Move to a Fixture-Gated/Not-Supported note until the feature ships.

---

## Regression checks (run after any change to these flows)

### MSG-TC-R01 · Realtime messaging integrity

**Objective:** Verify message send/receive, delivery status, and typing still work end to end.
**Steps:**
1. Exchange messages and an image between two users; observe status progression and typing indicator.
**Expected Result:**
- Messages deliver in real time; status advances sent→delivered→read; typing shows/clears correctly.

### MSG-TC-R02 · Notification delivery & deep links

**Objective:** Verify key events still produce notifications that deep-link correctly.
**Steps:**
1. Trigger a trade-message, a trade-status change, and a listing-approval; tap each notification.
**Expected Result:**
- Each notification arrives and routes to the correct screen; read state updates.

### MSG-TC-R03 · Safety alerts cannot be suppressed

**Objective:** Verify recall/safety push remains on regardless of preferences.
**Steps:**
1. Turn all Safety toggles off where allowed, then trigger a recall match.
**Expected Result:**
- The critical safety push is still delivered.

### MSG-TC-R04 · ID verification lifecycle

**Objective:** Verify submit → review → approve/reject → badge/notify still works.
**Steps:**
1. Submit a request, approve one and reject another from admin.
**Expected Result:**
- Approval grants the Verified badge and notifies; rejection notifies with reason; screenshots are removed after decision.

### MSG-TC-R05 · Moderation does not leak flagged items

**Objective:** Verify flagged/rejected/needs-edits items are not publicly visible.
**Steps:**
1. Browse as another user for an item currently flagged/rejected/needs-edits.
**Expected Result:**
- The item is not visible until approved.

### MSG-TC-R06 · Referral reward config propagates

**Objective:** Verify admin reward changes reflect on the end-user screen and pause disables sharing.
**Steps:**
1. Change reward amounts and toggle the program off, then view the Referrals screen.
**Expected Result:**
- New amounts display; when paused, the banner shows and Share is disabled.

---

## Verification checklist mapping

| Verification item | Test cases |
|---|---|
| Conversation list (search/unread/empty) | MSG-TC-A01 |
| Chat thread + trade context | MSG-TC-A02 |
| Send text + delivery status | MSG-TC-A03, MSG-TC-R01 |
| Real-time receive | MSG-TC-A04, MSG-TC-R01 |
| Typing indicator | MSG-TC-A05, MSG-TC-R01 |
| Image message + viewer | MSG-TC-A06, MSG-TC-R01 |
| Message length limit | MSG-TC-A07 |
| Quick-reply chips | MSG-TC-A08 |
| Safety meeting banner | MSG-TC-A09 |
| Photo permission handling | MSG-TC-A10 |
| Badge grid earned/locked | MSG-TC-B01 |
| Badge detail modal | MSG-TC-B02 |
| Badge showcase on profile | MSG-TC-B03 |
| Badge unlock celebration | MSG-TC-B04 |
| Leaderboard | MSG-TC-B05 |
| Submit review (stars+comment) | MSG-TC-C01 |
| Rating-required validation | MSG-TC-C02 |
| Anonymous review | MSG-TC-C03 |
| Skip review | MSG-TC-C04 |
| Review display + aggregate (live numeric avg + (N reviews)) | MSG-TC-C05 |
| Report a review (spam/offensive/false-info/other) | MSG-TC-C06 |
| ID upload (library) | MSG-TC-D01 |
| ID capture (camera) | MSG-TC-D02 |
| ID submit → pending | MSG-TC-D03, MSG-TC-D06 |
| Duplicate pending blocked | MSG-TC-D04 |
| No-image validation | MSG-TC-D05 |
| Approved → Verified badge | MSG-TC-D07, MSG-TC-R04 |
| Rejected → reason + resubmit | MSG-TC-D08, MSG-TC-R04 |
| Admin queue (stats/filters/search) | MSG-TC-E01 |
| Admin approve | MSG-TC-E02, MSG-TC-R04 |
| Admin reject (reason required) | MSG-TC-E03, MSG-TC-R04 |
| Admin view details | MSG-TC-E04 |
| Admin message templates | MSG-TC-E05 |
| Referral code + hero | MSG-TC-F01 |
| Copy code | MSG-TC-F02 |
| Share code | MSG-TC-F03 |
| Active rewards display | MSG-TC-F04, MSG-TC-R06 |
| Referral history states | MSG-TC-F05 |
| Referral code at signup | MSG-TC-F06 |
| Program paused banner | MSG-TC-F07, MSG-TC-R06 |
| Admin reward config | MSG-TC-F08, MSG-TC-R06 |
| Safety review screen | MSG-TC-G01, MSG-TC-R05 |
| Appeal flagged/rejected | MSG-TC-G02 |
| Resubmit needs-edits | MSG-TC-G03 |
| Remove flagged listing | MSG-TC-G04 |
| Recall safety alert | MSG-TC-G05, MSG-TC-R03 |
| Admin flagged queue | MSG-TC-H01, MSG-TC-R05 |
| Admin approve item | MSG-TC-H02 |
| Admin reject item (reason) | MSG-TC-H03 |
| Admin request edits | MSG-TC-H04 |
| Dispute under review | MSG-TC-H05 |
| Dispute resolve/refund | MSG-TC-H06 |
| Enable push | MSG-TC-I01 |
| Push error states | MSG-TC-I02 |
| Notification center list | MSG-TC-I03 |
| Deep link + mark read | MSG-TC-I04, MSG-TC-R02 |
| Mark all read | MSG-TC-I05 |
| Pagination + refresh | MSG-TC-I06 |
| Real-time notification | MSG-TC-I07, MSG-TC-R02 |
| Category × channel toggles (live Notification Preferences) | MSG-TC-J01 |
| Default preferences (DB-driven) | MSG-TC-J02 |
| Always-on note (live footer copy) | MSG-TC-J03, MSG-TC-R03 |
| Quiet hours + validation | MSG-TC-J04 |
