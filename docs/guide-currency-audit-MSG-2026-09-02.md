# Guide-Currency Audit — MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md

**Date:** 2026-09-02 · **Agent:** Guide-Currency Audit (read-only, Explore research) · **Scope:** Sections 2–4 of the Guide Currency Audit v2 task — **audit + classify only; NO guide rewrite performed.** A rewrite (if needed) becomes its own follow-up task.
**Guide audited:** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`
**Audit method:** READ-ONLY source audit of `p2p-kids-marketplace/` (mobile) + `p2p-kids-admin/` (admin) with the QA-Test-Agent §4 canonical rules (registered-route-without-caller = unreachable; exact UI strings verified from source; backend/notification cases classified separately). No files written by the audit.

**Key navigation facts:** Bottom tab bar = **Home | Discover | [Sell FAB] | Trades | Cart** — there is **no Messages/Inbox tab**. Messaging is reached via the header **chat icon** → `navigate('InboxTab')` (`AppHeader.tsx` L160, `DiscoverHeader.tsx` L92). `ConversationsListScreen` is registered under **two** routes: `InboxTab` (live) and `Conversations` (AppNavigator L698 — **no caller, dead duplicate**). Notification center via header bell → `navigate('Notifications')`.

---

## Per-group audit

### Group A — Messaging (A01–A10) → **Current** (10/10)

| TC | Surface | Verdict | Reason + evidence |
|---|---|---|---|
| A01 | Conversation list (`ConversationsListScreen`) | **Current** (minor path note) | Header "Messages"; empty `No messages yet` / `Start a trade and chat with other users!` + Browse Items; `No matches found`; unread cap `9+`; green ShieldCheck — all verbatim (`ConversationsListScreen.tsx` L346–394, L303–319). *Guide says "Messages tab" → actual entry is header chat icon (`InboxTab`), no bottom tab.* |
| A02 | Chat thread + trade context banner | **Current** | `ChatScreen` route `Chat` (callers: ConversationsList L262, ItemDetail L398, TradeList L854, TradeTimeline L729). Thumbnail + `View Trade` → trade timeline (L806–819). |
| A03 | Send + delivery status | **Current** | Send only when input has text + disabled while sending (L1017–1033); sent/delivered/read check states present; read-marking ~instant (L258+). |
| A04 | Realtime receive | **Current** | Realtime `postgres_changes` on `messages` (list L90+, Chat); needs 2-user fixture. |
| A05 | Typing indicator | **Current** | Presence channel `presence-trade-${tradeId}`, 3s inactivity stop (L313–484). 2-user. |
| A06 | Image send + viewer | **Current** | Upload spinner → `Alert('Error','Failed to upload image')`; image-viewer Modal (L601–643, L1040+). |
| A07 | 2000-char limit | **Current** | `MESSAGE_CHAR_LIMIT = 2000` + truncation notice (L102, L439–520). |
| A08 | Quick-reply chips | **Current** | `QuickReplyChips` = exact **5-chip set**: 📅 Available today / 📆 Available tomorrow / 🗓 Suggest times / 📍 Public place only / ⏰ Running late + `+ More` (`quick-reply-chip-*`) — `QuickReplyChips.tsx`. |
| A09 | Safety banner + modal | **Current** | Both `"Trade Smart, Trade Safe"`, button `"Got it — Let's Trade Safely"`; shown once per listing (L826–836, L1119–1166). |
| A10 | Photo permission denied | **Current** | `Alert('Permission Required','Please allow access to your photo library…')` (L572–576). |

### Group B — Badges (B01–B05) → **Current 4 / Stale 1**

| TC | Surface | Verdict | Reason + evidence |
|---|---|---|---|
| B01–B04 | Badges grid/detail/showcase/celebration | **Current** | `BadgesScreen` route `Badges` (caller `BadgeShowcase` L44); detail modal ("Keep going to unlock this badge!"); profile showcase; `BadgeCelebrationModal` (`🎉 New Badge Earned!`). B04 trigger = backend/fixture. |
| B05 | Leaderboard ranking | **STALE** | `LeaderboardScreen` file + route `Leaderboard` registered (AppNavigator L812) but **zero `navigate('Leaderboard')` callers in `src`** — reachable only via a `leaderboard_rank_up` notification / `/leaderboard` deep link (`deepLink.ts` L71, L157). Guide's "Open the Leaderboard screen" implies a static entry that doesn't exist → rewrite step / mark fixture-gated. |

### Group C — Reviews (C01–C06) → **Current 4 / Stale 2**

| TC | Surface | Verdict | Reason + evidence |
|---|---|---|---|
| C01–C04 | Submit review / rating required / anonymous / skip | **Current** | Route `SubmitReview` (callers: TradeSuccess L332, TradeTimeline L714, TradeDetail L297). **Resolved caveat:** `Alert('Success','Your review has been submitted!')` **exists** (`SubmitReviewScreen.tsx` L106). `Rating Required` (L72–74); `Post anonymously` toggle (L223); `Skip for Now` (L258). |
| C05 | Review display on seller profile | **STALE** (copy) | `SellerProfileScreen` shows star row + numeric average + `(N reviews)` + header `Reviews (N)` + `No ratings yet`/`No reviews yet` (L299–469). The literal strings `"Average Rating: {x}/5"` / `"Total Reviews: {n}"` in the guide **do not exist**. |
| C06 | Report a review | **STALE** (copy + options) | `review-menu-button`, `review-report-spam/offensive/false-info` live (`ReviewCard.tsx` L117–148). But success copy is now `Alert('Success','Review reported. Thank you!')` (L81), not the guide's "Thank you for reporting. We will review this content." (changed per TRD-TC-Q15 / DEV-TASK-75 2026-08-31). A **4th option `Report Other`** exists (L154). |

### Group D — ID Badge Verification, End User (D01–D10) → **Current 8 / Backend-gated 2**

`IDVerificationUploadScreen` route `IDVerificationUpload` (callers: Profile "Verify Identity" promo L551, dashboard verify banner L410). D01–D08 all copy verbatim (`IDVerificationUploadScreen.tsx`): no-ID-storage disclaimer (L39), photo/camera denial alerts, no-image `Please select an image`, duplicate-pending alert, "Submitted Successfully … within 24 hours", pending "Verification Pending … 24–48 hours", verified `Identity Verified` + `Verified ✓`. Rejected → resubmit State A (D08 ✓); rejection reason arrives via **notification** (backend). D07 minor icon nuance: seller profile shows `IdentificationCard` icon (not ShieldCheck). **D09 (submission notifications) / D10 (decision-notification channel prefs) = Backend/fixture** — EF `id-badge-submission-notification`; preferences UI exposes **no explicit ID-verification category**.

### Group E — ID Badge Verification, Admin (E01–E06) → **Current 5 / Backend 1**

Admin `p2p-kids-admin/src/app/id-badges/` (queue + review + details + messages). E01 queue (stats + filters + Review/View), E02 approve, E03 reject (`REJECTION_REASONS` match guide exactly; empty → `alert('Please select a rejection reason')`), E04 completed details (read-only + screenshot-deleted note), E05 message templates — all **Current** (E05 minor: save confirm is inline `✓ Saved successfully`, not a "Message saved" dialog). **E06 (admin alert on submission) = Backend** (EF `id-badge-submission-notification`).

### Group F — Referrals (F01–F08) → **Current 8/8**

`ReferralsScreen` route `ReferralDashboard` (callers: Profile "Share & Earn" L525, SpWallet L221) + live `auth/SignupScreen.tsx` + admin `referrals/configuration-tab.tsx`. Hero/copy/8-char code box, copy alert, share, rewards, history (pending grey / completed green), paused banner, admin config — all verbatim. **F06 trap:** the registered route `Signup` = `src/screens/auth/SignupScreen.tsx` (has `Referral Code (Optional)` + branded `Invalid Referral Code` dialog L244–280); a **stale top-level `src/screens/SignupScreen.tsx`** (ZIP-based, no referral field, zero importers — dead) is NOT the registered screen. Don't be misled by the stale file when verifying F06.

### Group G — Safety & Compliance, End User (G01–G09) → **Current 4 / Backend-config 5**

`ListingSafetyReviewScreen` route `ListingSafetyReview` (opened from MyListings flagged/rejected/needs_edits rows). G01–G04 status copy/reason box/appeal validations/Remove-Listing confirm — verbatim (`ListingSafetyReviewScreen.tsx` L88–112, L226–287, L424) → **Current**. **G05–G09 = Backend/config/fixture:** G05 recall safety alert (server-side CPSC path; guide's own caveat stands — no `Recall Alert` literal); G06 appeal max attempts (`moderation_appeal_max_attempts`, config L220); G07 appeal window (`moderation_appeal_window_days`, config L230); G08 AI moderation toggle (`moderation_ai_enabled`, config L210); G09 recall toggle/threshold (`cpsc_recall_check_enabled` + `cpsc_match_threshold`, config L354+). Guide's Deferred note (no user-facing "Report Item"/prohibited list) confirmed accurate.

### Group H — Safety & Compliance, Admin (H01–H06) → **Current 6/6**

Admin `items/flagged/page.tsx` + `disputes/`. Queue/filters/details, approve confirm + `Item approved successfully`, reject requires reason, Request Edits requires note, Mark Under Review, Resolve Complete/Refund — all verified.

### Group I — Notifications: Permission & Center (I01–I07) → **Current 7/7**

`NotificationSetup` (Settings → Enable Push, `SettingsScreen.tsx:120`) + `NotificationCenterScreen` route `Notifications` (header bell). Setup copy + enabled local notification; web/Android device notes; center type-icon/color map + unread styling; tap → deep-link + mark-read; `Mark all read`; PAGE_SIZE 20 load-more; realtime prepend (L472). I07 arrival needs another user/event → multi-user fixture.

### Group J — Notification Preferences (J01–J05) → **Current 1 / Stale 3 / Dead-premise 1** — *main drift in this guide*

| TC | Surface | Verdict | Reason + evidence |
|---|---|---|---|
| J01 | "Notification Settings" category×channel cards | **STALE** | The screen the guide's copy matches — `src/screens/notifications/NotificationSettingsScreen.tsx` (`Trade Updates`, `Safety Alerts`, defaults table) — is **NOT registered and has zero live callers** (only its own unit test). The **live** screen is `NotificationPreferencesScreen` (route `NotificationPreferences`, entry Settings L127) with taxonomy {Subscription & Membership, Swap Points Events, Badges & Achievements, Trades & Transactions (`Trades & Transactions`, not `Trade Updates`), System Updates} — **no `Safety Alerts` category**. |
| J02 | Default preferences | **STALE / backend-state** | Live screen loads from DB (`getNotificationPreferences`); guide's default set (incl. Safety) matches the **dead** screen's `DEFAULT_PREFS`. Assert against seeded DB rows. |
| J03 | Safety always-on note | **STALE** (copy) | Live footer reads `"Critical system alerts and safety notifications cannot be disabled."` (L421), NOT the guide's sentence about product recalls (that exact text lives only in the dead `NotificationSettingsScreen` L184). Semantics preserved. |
| J04 | Quiet hours (subscriber) | **Current** | Live `NotificationPreferencesScreen` (subscription card → Quiet Hours); `Enable Quiet Hours`, HH:MM, `Invalid time format` alert (L201), `Save Quiet Hours` (L405). |
| J05 | ID-verification preference controls decision delivery | **DEAD-premise / Stale** | **No `id_verification` category** exists in the live UI or in the `NotificationCategory` type union (`subscription\|sp_events\|badges\|trades\|system`, `notificationPreferences.ts` L7). Cannot be executed as written. ID-verification *type* notifications still appear in the center (`id_verification_*` icon map). |

### Regression (R01–R06) → **Current 2 / Backend-gated 4**

R01 Realtime messaging integrity — **Current** (2-user). R02 Notification delivery & deep links — **Backend/fixture**. R03 Safety alerts cannot be suppressed — premise shifts: live UI has **no Safety toggles at all** → "turn all Safety toggles off" isn't actionable in-app (**Backend/config**). R04 ID lifecycle — surfaces Current, decision/notify/delete-screenshot is EF (**Backend**). R05 Moderation doesn't leak — DB/RLS + moderation EF (**Backend/RLS**). R06 Referral config propagation — **Current**.

---

## Roll-up

**Counts (78 cases A→R):**
- **Current:** 59 — A01–A10, B01–B04, C01–C04, D01–D08, E01–E05, F01–F08, G01–G04, H01–H06, I01–I07, J04, R01, R06.
- **Stale:** 6 — B05 (no manual entry — deep-link only), C05 (copy), C06 (copy + 4th option), J01, J02, J03 (notification-settings taxonomy/copy).
- **Dead:** 1 — J05 (ID-verification preference category absent in live UI).
- **Fixture-gated / backend-only:** 12 — D09, D10, E06, G05, G06, G07, G08, G09, R02, R03, R04, R05.

**Top stale/dead findings (exact file evidence):**
1. **Group J targets a dead screen.** The taxonomy/defaults/safety-note copy the guide asserts (J01–J03/J05) belongs to `src/screens/notifications/NotificationSettingsScreen.tsx` — **unregistered and unreferenced** (only its own test imports it). The live, reachable screen is `src/screens/profile/NotificationPreferencesScreen.tsx` (route `NotificationPreferences`), category set {subscription, sp_events, badges, trades, system} — no `Safety Alerts`, no `id_verification`. **J05 should move to a Fixture-Gated/Not-Supported note.**
2. **B05 Leaderboard has no in-app entry** — registered route, zero `navigate('Leaderboard')` callers; only notification deep link.
3. **C06 report-review success copy changed** to `"Review reported. Thank you!"` (2026-08-31) + a 4th `Report Other` option added.
4. **C05 seller-profile copy drift** — numeric average + `(N reviews)`, not `"Average Rating: {x}/5"` / `"Total Reviews: {n}"`.
5. **Resolved caveats:** C01's "Your review has been submitted!" string **does** exist; G05 recall-wording caveat stands (no `Recall Alert` literal).

**Screens/files in the file tree with NO live caller (dead):** `src/screens/messaging/ConversationsScreen.tsx` (stub, never imported); `src/screens/notifications/NotificationSettingsScreen.tsx` (**the Group J screen**); `src/screens/SignupScreen.tsx` (top-level ZIP duplicate, zero importers); `src/screens/auth/SignupScreen.old.tsx` (legacy). Route `Conversations` (AppNavigator L698) registered-but-no-caller (superseded by `InboxTab`). Stray artifact `p2p-kids-marketplace/p2p-kids-marketplace/` (no package.json — not built) and out-of-project duplicate `kids_marketplace_app/src/components/NotificationSetup.tsx` — cleanup flags only.

**QA-round scoping recommendation:** Run Groups A, B01–B04, C01–C04, D, E, F, G01–G04, H, I, J04, R01, R06 as written (micro-notes: A01 "Messages tab"→header chat icon; D07 icon nuance; E05 "Saved successfully"; B04/D09/D10/R02–R05 trigger conditions). **Rewrite before running:** B05, C05, C06, and Group J (J01–J03/J05) to point at the live `NotificationPreferencesScreen` + updated strings; move J05 to a Fixture-Gated/Not-Supported note.
