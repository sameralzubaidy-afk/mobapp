# QA Run Report — MSG Guide First Live Execution Round (2026-09-03)

**Guide:** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md` (fully audited + rewritten 2026-09-02; first live run against the corrected copy).
**Environment:** iPhone 17 Pro Max simulator (iOS 26.1, UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), Metro `:8081`, admin `:3001`, web `:3002`. Staging Supabase `drntwgporzabmxdqykrp`.
**Personas used:** test-buyer (`49243010-…`), test-seller (`14be337c-…`).
**Evidence:** `screenshots/MSG-*.png` (this folder).
**Run window:** ~07:00–07:25 local (11:00–11:25Z).

---

## Verdict summary (executed this round)

| Group | PASS | FAIL | BLOCKED | SKIPPED/NS | Notes |
|---|---|---|---|---|---|
| B — Badges | B01, B02, B03 | — | B05 (screen-render leg) | — | B05 = reachability **finding** (see Critical Findings) |
| C — Reviews | **C01, C02, C03, C04, C05, C06** | — | — | — | Full C group closed; all audit-corrected copy verified live |
| A — Messaging | A01, A02, A03(send), A08, A09 | — | — | A04, A05, A06, A07, A10 (not executed — reasons below) | |
| I — Notifications | I03, I04, I05 | — | — | I06 (partial), I07 | |
| J — Notification Prefs | J01, J02, J03, J04 | — | — | J05 (🚫 NOT SUPPORTED per guide) | |
| F — Referrals | F01, F02, F03, F04, F05 | — | — | F06–F08 | |

**Executed verdicts this round: 23 PASS / 0 FAIL / 1 BLOCKED / 0 SKIPPED-as-scope.**
(A04/A05/A06/A07/A10 + I06-refresh + I07 + B04 were *assessed but not executed on-device* this session — precise reasons in the ledger. D/E/G/H + F06–F08 are the fixture-gated/admin batches — see ledger.)

---

## Per-case ledger

### Group B — Badges
- **MSG-TC-B01 (My Badges grid) — PASS.** 3-column grid (13 active badges); earned cells `#FFF9EC` cream background pixel-confirmed (40.4% of grid region); locked cells `#F7F7F7` @0.6 dim + `#999999` labels (source + OCR of locked names "50 Trades"/"1-Year Subscriber"). DB: test-buyer earned 11/13.
- **MSG-TC-B02 (Badge detail modal) — PASS.** Earned badge (Updated 10 Trades): modal shows name + description + **"Unlocked: 8/28/2026"** (matches DB awarded_at). Locked badge (50 Trades): name + description, **no Unlocked date**; gray Lock icon per source. Note (copy nuance): locked modal shows the badge's own description ("Completed 50 trades") not literal "Keep going…" — source-deliberate (`description || 'Keep going…'`), not a defect.
- **MSG-TC-B03 (Badge showcase on profile) — PASS.** Profile shows **"My Badges (11)"** title; horizontal strip of earned badges (source: horizontal FlatList; strip labels OCR-visible "SP Earner Platinum/Gold/Silver/Bronze"); tapping `badge-showcase` → My Badges (live). Empty-state copy source-confirmed ("No badges earned yet. Start trading to earn badges.").
- **MSG-TC-B05 (Leaderboard) — reachability FINDING + screen-render BLOCKED.**
  - **Finding (doc drift):** the guide's "open the `/leaderboard` deep link" leg does **NOT work**. `p2pkidsmarketplace://leaderboard` delivered twice did not navigate (app stayed on Profile). Source: React Navigation `linking.config.screens` in `AppNavigator.tsx` has **no `Leaderboard` path** (and none for `Badges`/`SpWallet`/`ReferralDashboard`/`Chat`/`TradeList` either); `services/deepLink.ts` is the *notification* deep-link service (parses `notification.data`), consumed only on notification arrival/tap — there is no raw-URL handler for `/leaderboard`.
  - The only live path to the screen is tapping a **`leaderboard_rank_up` notification** (NotificationCenter → `parseNotificationDeepLink` → navigate Leaderboard).
  - **DB check:** zero `user_notifications` rows of type `leaderboard_rank_up` exist for ANY user → no notification-tap fixture available; a read-only agent cannot create one.
  - Screen-render leg: **BLOCKED** (fixture-gated on a `leaderboard_rank_up` notification). Leaderboard data itself is healthy (RPC `get_badge_leaderboard(20)` returns 20 entries; test-buyer rank 3 with 11 badges).
  - **Recommended dev fix:** add `Leaderboard: 'leaderboard'` (and consider `/badges`, `/sp-wallet`, `/referrals`) to the AppNavigator linking config so the deep-link reachability claim in the guide becomes true.

### Group C — Reviews (full group closed)
- **MSG-TC-C01 (Submit review) — PASS.** SubmitReview screen ("Review the seller"): 5 stars, comment field with live "66/500 characters" count; selecting 5★ + comment + Submit → success GlobalAlert **"Your review has been submitted!"** (the 2026-08-12 "string not found" caveat is RESOLVED). DB: review `f4f3205f` (trade `01121468`, rating 5, named, active). ⚠️ Residue: 1 review added to test-seller's profile (cleanup candidate).
- **MSG-TC-C02 (Rating required) — PASS.** Submit with no star → GlobalAlert **"Rating Required / Please select a star rating before submitting."** No data created.
- **MSG-TC-C03 (Anonymous review) — PASS.** Toggled Post-anonymously + 4★ + Submit → success; DB: review `8565e7f8` `is_anonymous=true`. ⚠️ Residue: 1 anonymous review added.
- **MSG-TC-C04 (Skip review) — PASS.** "Skip for Now" → returned to Trade Timeline; DB: 0 reviews for that trade (no data).
- **MSG-TC-C05 (Review display on seller profile) — PASS.** test-seller public profile (via `/seller-profile/<userId>` deep link, which works): **"4.3" numeric avg + "(3 reviews)"** star row, **"Reviews (3)"** section header, histogram 5★:1 / 4★:2 / 3–1★:0, review cards (Test Buyer 2 Aug 31; **Anonymous User** Aug 30; Test Buyer Jun 29). **No old "Average Rating: X/5" / "Total Reviews: n" strings anywhere.** Correctly shows 0 review-⋯ menus to a non-owner viewer (reviewee-only privacy).
- **MSG-TC-C06 (Report a review) — PASS.** As test-seller (reviewee) on his own profile → Recent Reviews ⋯ → report sheet shows **4 options incl. the new "Report Other"** (`review-report-other`) → "Report this review as Other?" confirm → success **"Review reported. Thank you!"**. DB: `review_reports` row (review `8b65662d`, reason `other`, 11:14:48Z). ⚠️ Residue: 1 report row. (Note: the confirm dialog is the in-app GlobalAlertProvider, not native `Alert.alert` — guide `Dependencies` says native; minor doc drift. Earlier reported reviews `20c09442`+`14372222` from prior QA were avoided via the dedupe check.)

### Group A — Messaging
- **MSG-TC-A01 (Conversation list) — PASS.** Header "Messages"; rows show partner, trade chip "[Title] • $[Price]", last-message preview, relative time (23h ago/4d ago/Aug 25), unread "1" badges; search field filters by listing title ("Remote" → 1 result); no-result search → **"No matches found" / "Try a different search term"**. Empty-inbox leg not reachable (test-buyer has 4 conversations — fixture-gated on a zero-conversation user; empty-state copy source-verified).
- **MSG-TC-A02 (Chat thread + trade context banner) — PASS.** Active chat header shows partner avatar/name + listing title; trade context banner shows "[Title] • $[Price]" + View Trade link.
- **MSG-TC-A03 (Send text) — PASS (send leg).** Sent via a quick-reply template → message appears right-aligned with timestamp; input clears; send button only visible with text. DB: message `d7788d55` (trade `943097a5`, `delivery_status: sent`). Delivered→read progression needs the recipient persona to open the chat (single-sim limitation; see A04/A05).
- **MSG-TC-A08 (Quick-reply chips) — PASS.** Source confirms the **exact 5-chip set** the brief asked to spot-check: 📅 Available today / 📆 Available tomorrow / 🗓 Suggest times / 📍 Public place only / ⏰ Running late (`QuickReplyChips.tsx`, `INITIAL_VISIBLE=3` + "+ More" expander). On-device: 3 chips visible + "+ More"; tapping a chip inserts its payload into the input (verified live — 🗓 Suggest times auto-filled "I'm available on [DATE] at [TIME]…").
- **MSG-TC-A09 (Safety banner + modal) — PASS.** First open of an active chat → **"Trade Smart, Trade Safe"** safety modal with 5 tips + **"Got it — Let's Trade Safely"** button (exact copy per brief/guide). After dismissal the in-chat safety banner (`safety-banner`) shows; tapping the banner re-opens the same modal.
- **A04 / A05 (real-time receive / typing indicator) — NOT EXECUTED (fixture-gated).** Both require two concurrently-connected sessions on the same chat (a recipient already mounted in the thread when the sender types/sends). A single simulator cannot hold two logged-in app sessions; would need a second simulator or a device pair.
- **A06 (image message) — NOT EXECUTED.** Requires the native photo-library picker + upload. The `image-picker-button` is present; native-picker drivability is build-dependent and was not attempted this session.
- **A07 (2000-char limit) — NOT EXECUTED.** Requires a 2000+ char paste into the message input; high input cost, low marginal value this round.
- **A10 (photo permission denied) — NOT EXECUTED.** Requires OS photo-permission denial control (not reliably drivable).

### Group I — Notifications
- **MSG-TC-I03 (Notification center list) — PASS.** List titled "Notifications" with type-specific colored icon chips (green `#E8F5F0` chip pixel-confirmed 24% of icon column; source color map green/red/amber/purple/grey uses semantic tokens), title + body + relative time ("21h ago") per item, unread rows (DB: 25+ unread pre-run), "Mark all read" link.
- **MSG-TC-I04 (Tap → deep link + mark read) — PASS.** Message notification → **Chat** (read: DB `read_at` set); trade_completed notification → **My Trades** (read: DB `read_at` 11:07:54Z). Remaining destination types (SP→Wallet, subscription, ID) share the same source-verified `parseNotificationDeepLink` mechanism.
- **MSG-TC-I05 (Mark all as read) — PASS.** Unread 25+ → **0** across 1067 total notifications (DB-verified). ⚠️ State change: test-buyer now has 0 unread (regenerates from future trade events).
- **I06 (pagination + refresh) — PARTIAL.** Deep-scroll confirmed loading past page-1 items (older notifications render); pull-to-refresh gesture not independently driven this session (would need a top-of-list pull).
- **I07 (real-time arrival) — NOT EXECUTED.** Needs a second actor triggering an event while test-buyer is on the center (single-sim limitation).

### Group J — Notification Preferences (live screen)
- **MSG-TC-J01 (Category × channel toggles) — PASS.** Settings → Notification Preferences shows the **5 live categories**: Subscription & Membership / Swap Points Events / Badges & Achievements / Trades & Transactions / System Updates — no Safety category. Per-category Push/In-App/Email toggles (`toggle-<cat>-push|in_app|email`) update + persist: toggled `system-push` true→false→true, DB-verified both ways (`updated_at` 11:09:55Z).
- **MSG-TC-J02 (DB-driven defaults) — PASS (assessed).** Screen categories exactly match the 5 DB rows for the persona; no user-editable Safety category; the old `DEFAULT_PREFS`(w/ Safety) belongs to the dead, unregistered `NotificationSettingsScreen`. Fresh-user leg would need a new signup (screen is DB-loaded, so per-persona parity is the meaningful assertion).
- **MSG-TC-J03 (Always-on footer) — PASS.** Footer reads **"Critical system alerts and safety notifications cannot be disabled."** (live, `NotificationPreferencesScreen.tsx` L421) — exact guide copy.
- **MSG-TC-J04 (Quiet hours + validation) — PASS.** Invalid "9pm" → GlobalAlert **"Invalid time format / Please use 24-hour format: HH:MM (example: 22:00)."**; valid "21:30" → **"Saved / Quiet hours have been updated."** + DB `quiet_hours_start=21:30:00`; **restored to baseline 22:00** (DB-verified). Quiet-hours switches use `#5DBB8E` ON track.
- **MSG-TC-J05 — 🚫 NOT SUPPORTED** (per guide: no `id_verification` preference category exists). Not attempted.

### Group F — Referrals
- **MSG-TC-F01 (Referrals screen) — PASS.** Hero "Refer Friends, Earn SP" + subtext; 8-char code **42dvco4j** in a code box; "You've earned 0 SP from referrals".
- **MSG-TC-F02 (Copy code) — PASS.** Copy → GlobalAlert **"Copied! / Referral code copied to clipboard"**.
- **MSG-TC-F03 (Share) — PASS.** Share → native iOS share sheet with referral message ("Join Kids Club+ and get 20 SP for trade and 2…" + share actions).
- **MSG-TC-F04 (Active rewards) — PASS.** Rewards card lists First Trade Bonus +20 SP, First Listing Bonus +25 SP (referee) + referrer "40 SP per trade • 10 SP per listing".
- **MSG-TC-F05 (Referral history) — PASS.** Empty state "No referrals yet — share your code!".
- **F06–F08 — NOT EXECUTED** (F06 needs a fresh signup + second user's code; F07 needs admin to pause the program; F08 is an admin-portal config case — queued for the admin batch).

### Groups D/E (ID verification), G/H (Safety), remaining — Fixture-gated / admin-ledger
- **D01–D10 (end-user ID verification): NOT EXECUTED.** Requires ID-photo image fixtures + native camera/library picker drivability (D01/D02), an admin approve/reject cycle for the decision legs (D07/D08/D10 — admin portal), and push/email channel fixtures for the notification legs (D09/D10). DB-verified: no standing pending request exists for the test personas (only old 2026-03/05 rows for other users). Read-only agent cannot fabricate the ID-upload state or drive real approval decisions without the admin path — recommended as a **dedicated fixture + admin session** (R41 class).
- **E01–E06 (ID admin): NOT EXECUTED.** Needs a pending ID-verification request in the admin queue to review (none current). Queued with D.
- **G01–G09 (Safety end-user): NOT EXECUTED.** Requires flagged/rejected/needs-edits listings, a CPSC recall-keyword fixture, and `admin_config` moderation toggles (`moderation_appeal_max_attempts`, `moderation_appeal_window_days`, `moderation_ai_enabled`, `cpsc_recall_check_enabled`, `cpsc_match_threshold`) which are admin-side config changes.
- **H01–H06 (Safety admin): NOT EXECUTED.** Needs flagged-item + dispute fixtures in the admin moderation queue.
- **B04 (badge celebration on unlock): NOT EXECUTED.** Celebration fires on a *server-side badge award* (trade-completion trigger); no QA award fixture found; would need completing a qualifying trade live.
- **R01–R06 (regression): NOT EXECUTED** — depend on the above fixture-gated flows.

---

## Design-System Compliance notes (screens visited)

- **Canonical headers confirmed** on every visited screen (My Profile, My Badges, Seller Profile, Chat, Messages, Notifications, Notification Preferences, Referrals, Trade Timeline, SubmitReview): `back-button` 40×40 gray circle, icon-only; bell + chat on the right. **No deviations** in back/header treatment.
- **Badge detail modal** close = `#5DBB8E` pill (pixel-verified); locked icon grey `#CCCCCC`; DS-conformant.
- **Notification icon chips** use semantic colors (`#E8F5F0`/`#5DBB8E` green, `#FEE2E2`/`#E85D75` red, `#FEF3C7`/`#F59E0B` amber) — DS-conformant.
- **Notification Preferences toggles** ON = `#5DBB8E` track (source); footer + quiet-hours DS-conformant.
- **Safety modal** (Trade Smart, Trade Safe): white sheet, single CTA — DS-conformant on the elements observable in-tree.
- **Referrals screen**: hero/CTA layout consistent with DS (single Share primary).
- **No raw support-email surfaces** encountered on any visited screen.
- Minor copy notes (not DS): the in-app-notification sub-label "Show badges inside the app" reads slightly off for a general in-app notifications channel, and the badge-locked modal shows the badge description rather than encouragement — both source-deliberate, low severity.

---

## Critical Findings (ranked)

1. **[B05 doc-drift / reachability] The `/leaderboard` deep link does not navigate** — `AppNavigator` linking config has no `Leaderboard` path (and no `Badges`/`SpWallet`/`Referrals`/`Chat`/`TradeList` paths either, so raw deep links to those are dead too). The guide's "reachable via the `/leaderboard` deep link" claim is **incorrect on this build**; the only live entry is a `leaderboard_rank_up` notification tap. Fix: add the missing `screens` entries to `linking.config` (dev-side task).
2. **C-group copy fully verified** — C01 success "Your review has been submitted!", C05 live seller-profile display (4.3 + (3 reviews) + Reviews (3), no stale strings), C06 "Review reported. Thank you!" + 4th "Report Other" option — all the audit-corrected copy is real on-device.
3. **Group J fully matches the rewritten guide** — 5 categories (no Safety), exact footer copy, quiet-hours validation + persistence. J05 correctly NOT SUPPORTED.
4. **[Minor doc drift]** C06's confirm dialog renders via the in-app `GlobalAlertProvider` (`global-alert-button-0/1`), not native `Alert.alert` as the guide `Dependencies` states.

## Locator-gap findings
- Profile "Share & Earn" referral card is a touchable that does not surface as a distinct AX button (tapped by derived coordinates).
- My Badges grid tiles and Notification icon chips are not individually AX-exposed (verified via OCR/pixel instead).
- Safety modal + badge detail modal content is AX-exposed this build (positive — unlike some prior builds), so pixel-scan fallbacks were not needed there.

## Friction vs. operating rules
- **Notification Preferences top-of-scroll toggles:** AX-logical y for content scrolled under the fixed header overlaps the header buttons (a tap on `toggle-trades-push` hit the header bell and opened Notification Center). Resolved by tapping only mid-viewport toggles. (Same class as R17 header-overlap.)
- Profile flingy-scroll overshoots targets repeatedly (documented class).
- Software keyboard re-shows on field focus; used Cmd+A (select-all) + Cmd+K (dismiss) techniques throughout (worked reliably).
- `rg` not installed in the active shell (used `grep`/`node`).

## App State Left Behind (cleanup for next session)
- **Reviews created (C01/C03):** `f4f3205f` (5★ named, trade `01121468`) + `8565e7f8` (4★ anonymous, trade `d55a58a8`) — now on test-seller's profile (profile shows 5 reviews / avg recomputed). Cleanup = dev delete or reseed.
- **Review report created (C06):** `review_reports` row on review `8b65662d` (reason `other`).
- **Message sent (A03):** `d7788d55` on trade `943097a5` (Cash-Only Item) — first message in that chat (now a live active-thread fixture).
- **Notifications:** test-buyer unread 25+ → **0** (Mark all read). 2 notifications read individually.
- **Notification prefs:** restored to baseline (system-push ON; quiet hours 22:00–08:00). No config drift.
- Sessions: test-buyer logged in on the Referrals screen. test-seller's profile unchanged except the added reviews.

## How to Verify / Reproduce
- Screenshots in `e2e-test-results/qa-msg-first-live-2026-09-03/screenshots/` (MSG-B01/B02/B03/C01/C03/C05/C06/I03/J01/J03/J04/A02/A08/A09/F01/F03 …).
- B05 deep-link dead-end: `xcrun simctl openurl booted "p2pkidsmarketplace://leaderboard"` while logged in → observe no navigation.
- Review display: deep link `p2pkidsmarketplace://seller-profile/14be337c-aad6-403f-bab2-ba1a7d80b666`.
