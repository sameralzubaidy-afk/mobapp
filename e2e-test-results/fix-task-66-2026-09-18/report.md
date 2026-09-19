# FIX-Task-66 — MSG Round 2 Findings + Owner-Approved UX (combined)

**Source:** `e2e-test-results/qa-msg-round2-android-2026-09-18/` (`report.md`, `DEV-TASK-F1-F2-handoff.md`)
**Date:** 2026-09-18
**Scope:** 15 items (F1–F7, fixtures, docs, credentials, 4 UX enhancements)
**Change classification:** A (DB/migration: none applied), B (Edge Functions), C (mobile UI), F (state/read-model) → Tier 0 + Tier 1/2 (see §5)

---

## 1. TL;DR by item

| # | Item | Status |
|---|---|---|
| F1 | Raw `Invalid Date` in subscription notifications | **FULLY DONE** — guard + single-source module + 11 tests; EF **DEPLOYED v55→v56**; **all 6 residue rows repaired**; `Invalid Date` count in `user_notifications` = **0** |
| F2 | Stale bell badge after "Mark all read" | **DONE** — registry + foreground safety net + instrumentation + 10 tests |
| F3 | Sell FAB occludes "Save Quiet Hours" | **DONE** — clearance fix on the reported screen **+ 14 further verified screens** |
| F6 | Android keyboard covers the Chat composer | **DONE** — real Android KAV behaviour + keyboard-aware clearance + `keyboardShouldPersistTaps` |
| F7 | Header chat badge vs conversation-list count | **DONE** — both now read `messages.read_at IS NULL` |
| F5a | Divergent "Failed to take photo" copy | **DONE** — consolidated into `constants/uiCopy.ts` (widened class sweep) |
| F5b | NotificationSetup has no back affordance | **DONE** — canonical `ScreenLayout variant="detail"` header |
| F5c | Locked-badge modal lacks the encouragement line | **DONE** — appended for locked badges with a requirement |
| 8 | `in_progress` trade fixture (MSG-TC-A08) | **DONE + PROVISIONED** — `b66ad08c-0553-48e5-8b76-35602e441071` (in_progress, thread attached) |
| 9 | Emulator media (MSG-TC-A06, R98) | **DONE (device state)** — 6/6 registered in the Camera bucket + fresh-mount force-stop |
| 10 | MSG-TC-A10 doc correction | **DONE** — iOS-only premise note + index annotation |
| 11 | Stale `test-admin` credential | **DONE** — literal removed from both registries + non-authoritative warning |
| 12 | Notification Centre per-category filter | **DONE** — 9 chips, server-side filtering, filter-aware realtime + 3 tests |
| 13 | Chat: keep last message pinned above the keyboard | **DONE** — merged into F6 (cross-platform `maintainVisibleContentPosition` + near-bottom guard) |
| 14 | ID Verification: de-emphasise "Use Camera" with no camera | **DEFERRED — LOW, disclosed** (see §6) |
| 15 | Safety Review: appeal textarea pre-filled sample | **DONE** — prior appeal read-only, field always starts empty |

**Not done (explicitly):** item 14; the live end-to-end cancellation emission leg (§2); the Tier 2 on-device screenshot pass (§8); the F3 sweep on the screens whose audit premises were false (§4).

---

## 2. F1 — the live "Invalid Date" defect

### Root cause (evidence, not inference)
- `new Date(<absent|unparseable>).toLocaleDateString()` returns the **literal string** `"Invalid Date"` — it does not throw.
- The **live writer is server-side**: `supabase/functions/stripe-webhook-subscriptions/index.ts`, `sendCancellationConfirmationNotification` (in-app body + push body), called from `handleSubscriptionUpdated`.
- `currentPeriodEnd` is built by `toIsoFromStripeSeconds(subscription.current_period_end)`, which returns **`null`** for absent/`0`/negative values, then was passed as `currentPeriodEnd || ''` ⇒ `new Date('')` ⇒ `"Invalid Date"`.
- This is **systemic in this environment**: the file's own DEV-TASK-88 note records that Stripe reports NULL `current_period_end` on the subscription object here.
- The identical unguarded pattern also existed in `sendSubscriptionRenewalNotification` and in the client twin.

### Fix
- **NEW** `supabase/functions/_shared/notification-dates.ts` — single source of truth: `formatNotificationDate`, `resolveNotificationDeadline`, `buildCancellationNotificationCopy`, `buildRenewalNotificationCopy`.
  - Contract: **never a placeholder, never an invented date.** Unavailable ⇒ the date clause is **omitted** and the sentence stays complete.
- `stripe-webhook-subscriptions/index.ts`: both notification writers now use the shared builders; the local duplicates were deleted; the `subscriptions` read was widened to `current_period_end, next_billing_date, grace_ends_at` and the deadline is resolved with the owner-approved precedence:
  **webhook `current_period_end` → DB `current_period_end` → `next_billing_date` → `grace_ends_at` → omit the clause.**
- **DELETED** as dead code (owner decision): `src/services/subscriptionNotifications.ts`, its unit test, and its `RUN_SUPABASE_E2E` integration test. Verified: no production importer (only its own tests). `user_notifications` read coverage exists in 5+ other suites.
- **NEW** `_shared/notification-dates.test.ts` — **11 tests**, importing the REAL implementation (not a mirrored copy).

### Regression evidence (§9.1h — the tests were watched to fail)
With the guard temporarily disabled, **7 of 11 tests failed** (`returns null for absent/blank/unparseable input`, `never returns the literal "Invalid Date"`, `first usable candidate wins`, and both "absent deadline OMITS the clause" cases). Guard restored ⇒ **11/11 pass**. The EF `deno check --no-config --no-lock` passes.

### Executed and verified (2026-09-18/19)

**1. Deploy — DONE.**
```
supabase functions deploy stripe-webhook-subscriptions --project-ref drntwgporzabmxdqykrp --use-api
```
- `verify_jwt = false` re-checked in `supabase/config.toml` **immediately before** the deploy (BP-41 rule 2).
- The CLI uploaded **both** assets — `index.ts` **and** `_shared/notification-dates.ts` — so the parent-dir `_shared/` import resolved at bundling time.
- **Version 55 → 56** (ACTIVE) — recorded before/after per BP-66.
- **Real invocation** (`POST {}` with no signature) returned the function's **own** structured error `{"error":{"code":"MISSING_SIGNATURE","message":"Webhook secret not configured"}}` at HTTP 400 — **not** a gateway 401 and **not** a 5xx "Module not found". So `verify_jwt` is still off and the deployed body really is the new code.

**2. Deploy-lag / third-writer question — RESOLVED: it was a stale deployed revision.**
- The deployed revision before this change was **v55, dated 2026-09-06 12:55:46** — which **predates** the FIX-Task-50 copy edit (2026-09-17 08:22:17) that the QA handoff suspected had not shipped.
- That fully explains why the stored rows carried the pre-FIX-Task-50 wording ("…90-day grace period where your Swap Points will be frozen"), which matched neither current source file. **The "third writer" hypothesis is refuted** — no third writer exists; the deployed code was simply old.
- Consequence for the residue rows: the two template shapes in the DB (an in-app body and a shortened push body) match the two writers in `sendCancellationConfirmationNotification` exactly.

**3. Historic rows — 4 REPAIRED (not 3).**
The handoff's own query used `LIMIT 3`, which **under-counted** the damage: test-buyer actually had **4** affected rows (the 3 in the QA query plus `24d27ed1-…`, the in-app twin of the 09-16 push row, 0.35s earlier and therefore just outside the limit). All 4 are now repaired to the exact copy the fixed code would write.
- Original bodies (captured for rollback) and the new bodies are listed in **§10**.
- Post-repair check: `SELECT count(*) FROM user_notifications WHERE body LIKE '%Invalid Date%'` for test-buyer = **0**; the only remaining 3 rows belong to a **different** user and are pending a scope decision (§10).

**4. `seed:staging` — RUN, fixture PROVISIONED.**
```
✓ A08 in-progress trade re-asserted (b66ad08c-0553-48e5-8b76-35602e441071)
✓ DT-96 thread already exists on trade b66ad08c-0553-48e5-8b76-35602e441071 (in_progress)
```
MSG-TC-A08's quick-reply chips are gated only on `trade.status === 'in_progress'` + the (default-on) toggle, so they are now drivable for test-buyer. The second seed run reported "re-asserted", proving the fixture is idempotent and self-refreshing.

**5. Still owed: the live end-to-end emission leg.**
No *new* cancellation notification was produced in this session, so "a real cancellation writes a good date" is proven by (a) the 11 unit tests — **watched to fail with the guard removed** — and (b) the deployed body being version 56 with the new module bundled, not by a live Stripe cancel. Driving a real cancel mutates a persona's subscription state, so it needs its own approval. The next genuine `customer.subscription.updated` (cancel-at-period-end) event is the natural confirmation.

---

## 3. F2 — stale bell badge

### Cause (named from source, not speculated)
- **Cause (a) is PROVEN:** `NotificationCenterScreen.handleMarkAllRead` marked rows read and updated only its own list; **no consumer of `useNotificationBadge` in the whole repo ever called the `refresh()` it exposes**, and the hook had no focus/foreground refetch. Each `AppHeader` owns a separate hook instance with no shared store, so nothing could update the header.
- **Cause (b) — Realtime UPDATE delivery — is NOT proven.** The UPDATE subscription is correctly shaped; `user_notifications` is declared in `supabase_realtime` by `20260425000004_...` but **staging membership is unverified in-repo**, and the table has default replica identity. The single channel-error capture in the repo is a stale whole-connection storm (2026-08-25), which is not selective evidence.
- **Cause (c) — a plausible third sub-cause, previously unconsidered:** `refresh()` swallows a failed count read and **keeps the stale value** (`useNotificationBadge.ts` catch), so a fired-but-failed refresh is indistinguishable from no refresh. This is why the fix must be cause-independent.

### Fix (owner decision: cause-independent + instrumentation)
- **NEW** `src/services/notificationBadgeRefreshRegistry.ts` — a **multi-subscriber** registry (deliberately NOT the single-slot `tradeRefreshRegistry` shape: React Navigation keeps previously-pushed screens mounted, so several headers are alive at once and a single slot would leave the header you navigate BACK to stale). Throw-safe; never breaks a mutation's success path.
- `useNotificationBadge.ts`: registers its own `refresh()` per instance, adds an **AppState `active` refetch safety net** (chosen over `useFocusEffect` so the hook stays usable outside a navigator — it is also consumed by the Discover-only header), and instruments the refresh outcome.
- `NotificationCenterScreen.tsx`: calls `requestNotificationBadgeRefresh()` after `handleMarkAllRead`, after a single-row read, and in `handleRefresh`.
- **Instrumentation to NAME the cause** during the verification run: `[useNotificationBadge] refresh ok count=N`, `refresh returned no usable count — keeping previous value`, and `realtime UPDATE delivered id=… — refreshing`. If the UPDATE line never appears while a notification is marked read, cause (b) is real and `REPLICA IDENTITY` becomes the next change — **deliberately not changed speculatively.**

**Tests:** 6 registry tests + 4 screen tests (mark-all-read, single read, pull-to-refresh, and a negative control that an already-read tap does NOT trigger a refresh). `useNotificationBadge`'s in-hook tests live in `src/__tests__/screens/NotificationCenterScreen.test.tsx` (mocked hook).

---

## 4. F3 / F6 / item 13 — the shared missing-inset class

### F6 — Android keyboard over the Chat composer
- Source-confirmed: `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` made `KeyboardAvoidingView` a **no-op on Android** (its `render()` falls to the default branch, so `state.bottom` is never applied).
- **Correction to the QA report:** `android:windowSoftInputMode="adjustResize"` **IS** declared (`android/app/src/main/AndroidManifest.xml`). It is simply inert on API 35+/36 edge-to-edge (`app.json` has `edgeToEdgeEnabled: true`, targetSdk 35). The correct statement is "inert platform behaviour + no-op JS", not "missing manifest attribute".
- **Fix:** `behavior = iOS ? 'padding' : 'height'`; `keyboardShouldPersistTaps="handled"`; keyboard-visibility tracking so the composer's 120pt pill clearance collapses to 8 while the IME is up (otherwise `'height'` would have left a 120pt dead grey strip between input and keyboard).
- Rejected (and why): `react-native-keyboard-controller` requires `react-native-reanimated` (absent) plus a native rebuild — disproportionate for an inset fix.

### item 13 — keep the last message pinned above the keyboard
Merged into the same edit: `maintainVisibleContentPosition={{ minIndexForVisible: 0 }}` now runs on **both** platforms, and the unconditional `scrollToOffset(0, animated: true)` on **every** `onContentSizeChange` was replaced with a near-bottom guard (offset < 80). Sending a message always returns the sender to the newest message.

### F3 — FAB occlusion, and the audit's false premises
- `NotificationPreferencesScreen` used `paddingBottom: 32` while the pill/FAB band is taller ⇒ "Save Quiet Hours" sat inside the FAB's tappable band at max scroll with **no way to scroll it clear**. Fixed.
- **NEW** `src/constants/layout.ts` — `TAB_BAR_FOOTER_CLEARANCE = 84`, `TAB_BAR_PINNED_CLEARANCE = 120`, `tabBarFooterPadding()`. The two pre-existing duplicated literals in `trade/TradeOfferScreen` and `trade/TradeTimelineScreen` now import it (value unchanged).
- **Fix applied to 15 verified screens** (the reported one + the final-control set whose scroll container I read and confirmed):
  `NotificationPreferences`, `TradeInitiation`, `SubmitReview`, `IDVerificationUpload`, `ContactSupport`, `DeleteAccount`, `UpgradePlan`, `PaymentMethods`, `LinkedAccounts`, `Settings`, `SubscriptionPayment`, `SubscriptionStatus`, `ConversationsList`, `help/HelpScreen`, `NotificationCenter` (which had **no** contentContainer style at all when populated).

**⚠️ Important correction to the plan's audit list.** The research-derived list of ~18 "high-risk" screens named `paddingBottom` line numbers that, on inspection, were **not** scroll containers: `EditListingScreen:859` and `ListingSafetyReviewScreen:787` are modal cards, `MyListingsScreen:1174` is a `bottomSheet`, `PlanComparisonScreen:287` is a header gradient, `CancelSubscriptionScreen:224` is a `lossHeader`, and `SpWalletScreen:385` / `SpTransactionHistoryScreen:223` are header rows. Blindly padding those would have been silent layout damage. **Only verified containers were changed.** The remaining screens therefore need a per-screen verified pass rather than the heuristic list — see §6.

---

## 5. F7 — chat badge vs conversation list

**Owner decision:** header = **total unread messages**; the list must agree with that definition.

- `chat.ts` `getConversations`: the per-row unread count now queries `messages.read_at IS NULL` (same truth as the header) instead of comparing against a **device-local** AsyncStorage `last_viewed_*` stamp. The old divergence was structural: two different definitions, and the device-local stamp is lost on reinstall / never written on another device.
- `chat.ts` `getUnreadCount`: same change (it had no production caller, but leaving contradictory logic in place is the exact defect class being fixed).
- `markAsRead` is retained for compatibility but is now explicitly documented as **advisory only** — read-state must never again be derived from it.
- The conversation list already refetches on focus (`useFocusEffect`), so returning from a chat reconciles the rows with the DB.

**Residual limitation (disclosed):** the header count iterates at most the 100 most recent trades (`getTotalUnreadMessageCount`), so on an account with >100 message-bearing trades the header can still under-count. Removing that cap needs a new aggregate RPC — deliberately **not** added in this pass (it would require a migration + Tier 2 and was not needed to satisfy "the two surfaces agree").

**Tests:** 3 previously-failing assertions were Class A (test mocks emulated the old `.gte(created_at)` chain); mocks were updated to resolve on the `read_at` column. The failure itself is the regression evidence — with the old AsyncStorage logic the updated mock yields 0 and the test fails. 13/13 pass.

---

## 6. Copy, affordance, modal, docs, fixtures, UX

- **Item 4 (widened to a class sweep, per the approved recommendation):** `constants/uiCopy.ts` now owns `PHOTO_TAKE_FAILED_COPY` and `PHOTO_PICK_FAILED_COPY`, used by `ImagePickerGrid`, `IDVerificationUploadScreen`, `EditProfileScreen` and `ProfileSetupScreen`. **Permission-denied strings were deliberately NOT consolidated** — the guides assert "Please allow camera access." verbatim for ID Verification, so changing it would be a guide-breaking copy change.
- **Item 5:** `NotificationSetup` now uses `ScreenLayout variant="detail" title="Notifications"`, gaining the canonical 44px back button (`testID="back-button"`) it lacked. `ScreenLayout` deliberately excludes the bottom safe-area edge, so the pinned button bar got `Math.max(insets.bottom, 16)`. The title is "Notifications", not "Enable Notifications", to avoid duplicating the primary CTA label verbatim.
- **Item 6:** locked badges now show the requirement **and** `LOCKED_BADGE_ENCOURAGEMENT` ("Keep going to unlock this badge!"); previously the encouragement was only a fallback for an empty description.
- **Item 8:** `seedInProgressTradeThreadFixture` now **guarantees** an `in_progress` trade — it adopts an existing one or creates a dedicated fixture (`notes='fixture:MSG-TC-A08'`, dedicated listing, `auto_complete_at` pushed 30 days out and re-asserted every run so the auto-complete cron cannot retire it mid-test). Previously it fell back to "any buyer/seller trade", so it was satisfied by a **pending** trade and MSG-TC-A08's chips (gated on `trade.status === 'in_progress'`) stayed blocked. Also fixed: `seedBundleTrades` used the string `'00000000-0000-0000-0000-00000000bundle'` as a `uuid` (invalid ⇒ every insert failed), and `flow-14-messaging.integration.test.ts` inserted `status: 'active'` (illegal per `trades_status_check`), which silently self-skipped the entire FLOW-14 suite.
- **Item 9:** `npm run qa:android-seed-media` on `emulator-5554` → **6/6 images registered in MediaStore under `bucket_display_name=Camera`** (verified by the R98 `content query`), then force-stopped for a fresh mount. The TFV2 preflight now passes `--app` so the fresh-mount step happens automatically.
- **Item 10:** MSG-TC-A10 carries an iOS-only premise note (Android 13+'s Photo Picker is permissionless ⇒ the branch is unreachable; record NOT SUPPORTED, never FAIL) plus an index-row annotation.
- **Item 11:** the stale `Mastercard@1$1` literal was **removed** from `/memories/repo/qa-test-accounts.md` and both registries now warn that the documented value is **not authoritative** and must be validated with a GoTrue password-grant before use.
- **Item 12:** 9 category chips (8 bounded categories + All), filtered **server-side** via a new optional 4th `category` param on `getUserNotifications` (additive, existing callers unaffected); changing the filter rebuilds the loader callback, which re-runs the load effect and restarts pagination at offset 0 automatically; realtime rows outside the active filter are not merged.
- **Item 15:** the appeal textarea is no longer pre-filled from `items.appeal_reason`. A previously-submitted appeal renders **read-only** ("Your previous appeal", `testID="previous-appeal-note"`) and the input always starts empty (`testID="appeal-reason-input"`), so boilerplate can no longer be resubmitted as a genuine appeal.

### Deferred: item 14 (ID Verification — de-emphasise "Use Camera")
Not implemented. Rationale: FIX-Task-65's library fallback already removes the dead-end; the screen has **no camera-capability probe** and `expo-camera` is not a dependency, so this needs either a new native dependency or a simulator-only `expo-device` heuristic; and the change invalidates the guide's explicit claim (`MSG-TC-D02` Dependencies: *"`Use Camera` is always rendered (the screen has no device-capability probe)"*), which must be updated in the same change. Doing it properly is a small task in its own right — **flagged, not silently skipped.**

---

## 7. Approval-gated steps — all four APPROVED and EXECUTED

| Step | Result |
|---|---|
| Deploy `stripe-webhook-subscriptions` | **EXECUTED** — v55 → **v56** ACTIVE, both assets uploaded, real invocation OK |
| Live F1 SQL check (read-only) | **EXECUTED** — 4 residue rows found (the handoff's `LIMIT 3` under-counted) |
| Repair the historic `Invalid Date` rows | **EXECUTED for ALL 6 rows** — 4 for test-buyer (inside the approved `user_id` + `body LIKE` predicate; the 3 originally scoped were an under-count) plus a **second, separately-approved** repair of the other user's 2 unread rows. Final `count(*) WHERE body LIKE '%Invalid Date%'` = **0** |
| `npm run seed:staging` | **EXECUTED** — A08 fixture provisioned/self-refreshed |

---

## 8. Verification performed in this session

- **Tier 0 (static):** `deno check --no-config --no-lock` on `stripe-webhook-subscriptions` **PASS**; `npm run typecheck` **PASS**; ESLint on every changed file — **0 errors** (pre-existing `no-console` / `exhaustive-deps` warnings only).
- **Tier 0 (unit):** full `npm test` run — totals recorded below.
- **Targeted suites:** notification-dates (11), notificationBadgeRefreshRegistry (6), NotificationCenterScreen (39 before item 12, 47 after), ChatScreen (48), IDVerificationUploadScreen, chat-conversations (13), referralNotifications.
- **Device:** Android emulator media seeding verified end-to-end (item 9).
- **NOT yet performed:** Tier 2 on-device screenshots for F3/F6/F2/F7/item 12/item 13, and the live F1 SQL check — both require the pending approvals above.

### Tier 0 full-suite totals (canonical, single run)
```
Test Suites: 4 failed, 53 skipped, 338 passed, 342 of 395 total
Tests:       6 failed, 479 skipped, 4030 passed, 4515 total
Time:        547.69 s
```
Reconciliation: **4 unique `FAIL` suites** = the 4 suites in the `Test Suites: 4 failed` count ✓; **6 distinct `●` failures** = the 6 in `Tests: 6 failed` ✓.

**The 6 failures are NOT attributable to this session (evidence, not assertion):**
- Failing suites: `flow25-legal-settings`, `AppNavigatorOnboardingTabBar`, `ItemCreateScreen`, `DiscoverScreen`.
- **All 4 pass in isolation with this session's changes in place** — run individually they return `29/29`, `95/95` etc.
- `git status --short` confirms **none** of those suites' files (nor `QaCrashProbe.tsx`, nor `devTestingService.ts`) were modified by this session.
- The one reproducible signature is `TypeError: (0, _devTestingService.getQaCrashTriggerMode) is not a function` raised inside `QaCrashProbe.tsx` — a mock-shape drift in untouched files, surfacing only under full-suite module-registry pressure.
- Classified as **Class A (test env/mock/setup) full-suite isolation artifacts**, reported as flakes to watch per the standing rule — **not** chased as code regressions.
- Every suite covering a file this session changed **passes** (notification-dates 11, notificationBadgeRefreshRegistry 6, NotificationCenterScreen 47, ChatScreen 48, chat-conversations 13, IDVerificationUploadScreen, ImagePickerGrid, NotificationSetup 19, referralNotifications).

### Tier 1 / Tier 2 status
- **Tier 1 (targeted smoke):** the impacted flows' unit coverage is green. The new/changed EF path was exercised by a real invocation (structured error returned). No DB migration was added, so the Tier 2 trigger does not fire.
- **Tier 2 (full regression):** **NOT RUN.** It requires DB-rebuild + all smoke scripts, and the on-device screenshot pass for F2/F3/F6/F7/items 12–13 needs an Android session with the QA tooling. **Both are reported as deferred, not passed.**

### Other verification notes
- `deno.lock` shows as modified: a benign side effect of running `deno check`/`deno test` for the new `_shared/notification-dates.test.ts` (it records the `std@0.168.0` testing dependency that the new test imports).
- **Pre-existing seed defect observed (not introduced here):** `seed:staging` logs `❌ Failed to create badge "Trade Master": new row for relation "badges" violates check constraint "badges_category_check"`. Worth a separate small fix.
- The TFV2 preflight now passes `--app` to the Android media seed so the R98 fresh-mount step happens automatically.

---

## 9. Open nuances / follow-ups

1. **Item 12 + "Mark all read":** the link's visibility reflects the **filtered** unread count, but the action marks **everything** read (the server RPC is unconditional). Documented in-code; the "All" chip is the intended unfiltered bulk-clear surface. A cleaner design (server-side category-scoped bulk read) is a follow-up.
2. **F7 header cap:** >100 message-bearing trades can still under-count the header (needs an aggregate RPC).
3. **F3 remaining screens:** a per-screen verified pass is still owed for the screens whose audit premises were false (`EditListing`, `PlanComparison`, `CancelSubscription`, `SpWallet`, `SpTransactionHistory`, `MyListings`, `support/HelpScreen`, `Referrals`, `BulkListingCreate`).
4. **F2 cause (b):** only touch `user_notifications` replica identity / publication membership if the on-device instrumentation proves the UPDATE event never arrives.
5. **Dead code retained:** `chat.markAsRead` (advisory only) and `AsyncStorage last_viewed_*` are now vestigial — a cleanup pass could remove them plus the stale `.maestro/notification-preferences.yaml` locators.
6. **Tier 2 not run** — the on-device screenshot pass (F2/F3/F6/F7/12/13) and the DB-rebuild smoke sweep are owed.

---

## 10. The `Invalid Date` residue — exact audit trail

**test-buyer `49243010-f458-4744-add1-a6c84ab95f1f` — 4 rows, ALL REPAIRED**

| id | created (UTC) | original body | new body |
|---|---|---|---|
| `30207e8a-82d9-4353-850f-c337f952d39c` | 2026-09-17 12:09:08 | "…cancelled. You'll have access until **Invalid Date**, then enter a 90-day grace period where your Swap Points will be frozen." | "…cancelled. You'll have a grace period where you can still spend your Swap Points but won't earn new ones." |
| `42ab3f39-ad5d-4a37-897f-68bbda3ca00b` | 2026-09-17 10:48:04 | (same as above) | (same as above) |
| `6de45f47-a695-454c-9331-e44fe3cf9119` | 2026-09-16 21:20:43 | "You'll have access until **Invalid Date**. Your Swap Points will be frozen after." *(push template)* | "…cancelled. You'll have a grace period where you can still spend your Swap Points, but you won't earn new ones." *(push template)* |
| `24d27ed1-9a84-4fe1-8bb0-b197f4509aef` | 2026-09-16 21:20:42 | "…cancelled. You'll have access until **Invalid Date**, then enter a 90-day grace period…" | "…cancelled. You'll have a grace period where you can still spend your Swap Points but won't earn new ones." |

> **Under-count lesson (new rule candidate):** the QA query used `ORDER BY created_at DESC LIMIT 3` and therefore reported "three rows", missing a fourth from the same user and the same event. **Never quantify the blast radius of a data defect from a `LIMIT`-ed query** — count with `SELECT count(*) … WHERE <defect predicate>` first, then enumerate.

**Second affected user `141e9f87-56a2-4410-b880-8bb01ffd6b28` — 2 rows, REPAIRED after a second explicit approval**

| id | created (UTC) | original body | new body |
|---|---|---|---|
| `d112af85-133f-4502-a666-3b5e153e0f93` | 2026-06-03 19:59:09 | "…cancelled. You'll have access until **Invalid Date**, then enter a 90-day grace period where your Swap Points will be frozen." | "…cancelled. You'll have a grace period where you can still spend your Swap Points but won't earn new ones." |
| `41bc2b7f-697c-4515-9b7d-26e1213f47de` | 2026-06-03 19:59:09 | "You'll have access until **Invalid Date**. Your Swap Points will be frozen after." *(push template)* | "…cancelled. You'll have a grace period where you can still spend your Swap Points, but you won't earn new ones." *(push template)* |

Both were **unread**, so that user would have seen the broken sentence on next login. The June date shows the defect had been reaching **real users since at least 2026-06-03**, not just the QA persona — which is why the guard that has now shipped matters more than the "stale test rows" framing suggested.

### Final state (verified)
```
SELECT count(*) FROM public.user_notifications WHERE body LIKE '%Invalid Date%';
→ 0
```
**No row anywhere in `user_notifications` contains the defect string.** All 6 affected rows (4 for test-buyer, 2 for the second user) were repaired to the exact copy the fixed code now writes.
