# DEV TASK — F1 + F2 (handed off from MSG Round 2, Android)

**Source run:** `e2e-test-results/qa-msg-round2-android-2026-09-18/` (report.md, findings F1 & F2)
**Raised by:** QA Test Agent (execution-only — **no source was modified by QA**; this file is the hand-off)
**Owner decision (2026-09-18):** apply **F1** and **F2** as a separate dev task.
**Platform where observed:** Android (API 36 emulator `Medium_Phone_API_36.1`), build `cdb1f2ea`+
**Priority:** F1 = **MED-HIGH** (user-visible raw artifact on an entitlement-deadline message) · F2 = **MED** (badge contradicting the list)

---

## F1 — `"Invalid Date"` leaks into subscription-cancelled notifications

### Symptom (observed live)
Three `user_notifications` rows for **test-buyer** carry the literal string `Invalid Date` in a parent-facing message:

> "Your Kids Club+ subscription has been cancelled. You'll have access until **Invalid Date**, then enter a 90-day grace period where your Swap Points will be frozen."

It renders exactly like that in the app's Notification Center (twice in the visible list). Rendered verbatim from the DB — **not** a client-side formatting artifact.

### Evidence
```sql
SELECT id, type, title, body, is_read, created_at
FROM user_notifications
WHERE user_id = '49243010-f458-4744-add1-a6c84ab95f1f'
  AND type = 'subscription'
ORDER BY created_at DESC LIMIT 3;
```
Returns 3 rows (2026-09-16 21:20:43Z, 2026-09-17 10:48:04Z, 2026-09-17 12:09:08Z), all containing `Invalid Date`.

### Root cause
`new Date(accessUntil).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })`
returns the **literal string `"Invalid Date"`** when `accessUntil` is `undefined` / `null` / `''` / an unparseable value. **There is no guard.**

The identical `${formattedDate}` construction exists in **two** places:
| File | Line | Role |
|---|---|---|
| `supabase/functions/stripe-webhook-subscriptions/index.ts` | **1290** and **1311** | **THE LIVE WRITER** (see below) |
| `p2p-kids-marketplace/src/services/subscriptionNotifications.ts` | **163** (`notifyCancellationConfirmed`, fn at L146) | client copy — fix for consistency/parity |

**⚠️ Which one actually wrote these rows?** `notifyCancellationConfirmed` has **no production caller** — a full grep of `p2p-kids-marketplace/src/**` returns only its own unit test (`src/__tests__/services/subscriptionNotifications.test.ts:10,182,201`). ⇒ **the server Edge Function is the live writer**, and the client function appears currently uncalled. **Please confirm before fixing** (if the client path is genuinely dead, consider deleting it rather than patching it, to avoid two drifting templates).

**Second, separate suspicion — possible deploy lag (worth checking while you're in there):**
The **stored** wording ("…then enter a **90-day** grace period where your Swap Points will be **frozen**") matches **neither** current source file. Both current files say "…then a grace period where you can still spend your Swap Points but won't earn new ones." Two of the three stored rows **postdate** the client-side copy fix (`6551e386`, **FIX-Task-50 item 1**, 2026-09-17 08:22:17). So either (a) the deployed `stripe-webhook-subscriptions` revision lagged the repo, or (b) there is a **third** writer not found by grepping the copy string. Worth resolving so the fix actually reaches users.

### Why this one matters more than the stale rows suggest
**FIX-Task-50 item 1 edited this very line and left the date interpolation unguarded.** The defect is therefore **still live in HEAD**, not just historical — any cancellation event with a missing/invalid `accessUntil` will emit it again. The message tells the user *when their paid access ends*; an unreadable date makes the notification useless.

### Proposed fix
1. **Guard the interpolation** at all live sites. Preferred: a small shared helper, e.g.
   `formatAccessUntil(accessUntil, graceEndsAt)` that returns a formatted date, or `null` when unavailable.
2. **When the date is genuinely unavailable, omit the clause** rather than printing a placeholder — e.g. fall back to *"Your Kids Club+ subscription has been cancelled. You'll have a grace period where you can still spend your Swap Points but won't earn new ones."* Do **not** invent a date and do **not** print "unknown".
3. If a better source exists for the deadline (e.g. `subscriptions.grace_ends_at` / `current_period_end`), prefer deriving it server-side at write time instead of relying on the caller passing `accessUntil`.
4. Decide the client function's fate (patch for parity, or delete if dead).

### Acceptance criteria
- No code path can produce a body containing the substring `Invalid Date`.
- With a **valid** `accessUntil`, the notification still renders the formatted date exactly as today (no regression to the happy path).
- With a **missing/invalid** `accessUntil`, the body reads as a complete, natural sentence with **no** date clause (and no placeholder text).
- A unit test covers the invalid-input case for every live writer.

### How to re-verify
- Re-run a cancellation with a valid grace end → assert the date renders.
- Force `accessUntil` to `undefined` → assert the body has no `Invalid Date` and still reads naturally.
- Then confirm on staging: `SELECT body FROM user_notifications WHERE type='subscription' ORDER BY created_at DESC LIMIT 1;` must not contain `Invalid Date`.

---

## F2 — Header notification badge stays stale after "Mark all read"

### Symptom (observed live)
On Android: with the Notification Center open, tapping **Mark all read** correctly marks every row read (rows lose their unread background styling, titles unbold, the `Mark all read` link itself disappears) — **but the header bell badge continues to display `99+`**.

### Evidence
| Signal | Value |
|---|---|
| DB after the action | `SELECT count(*) FROM user_notifications WHERE user_id='49243010-f458-4744-add1-a6c84ab95f1f' AND is_read=false;` → **0** (was 289) |
| Notification list | all rows read; `mark-all-read-link` gone |
| **Header bell badge** | **still renders `99+`** ← the defect |
| Header chat badge (control) | updated correctly through the run (2 → 1 → 0) ⇒ **badge rendering itself is sound; this is a refresh gap** |

### Root cause (call sites named)
- Writer of the badge: **`useNotificationBadge(userId)`** — `p2p-kids-marketplace/src/hooks/useNotificationBadge.ts`
  consumed in `src/components/AppHeader.tsx:79` → `<CountBadge count={unreadCount} … testID="header-notifications-badge" />` (`AppHeader.tsx:154,158`).
- The hook exposes **`refresh()`** and refetches on mount; it also subscribes to Realtime `postgres_changes` **UPDATE** events on `public.user_notifications` filtered by `user_id` (logging `CHANNEL_ERROR` / `TIMED_OUT` when the channel fails).
- The bulk action lives in **`src/screens/notifications/NotificationCenterScreen.tsx:580` `handleMarkAllRead`** → `await markAllNotificationsAsRead(userId)` (**L589**) → then it reloads its own list.
- **The NotificationCenterScreen does not consume `useNotificationBadge` and never calls `refresh()`** ⇒ nothing tells the header to re-read. (Pull-to-refresh, `handleRefresh` at **L518**, has the same gap.)

### Two candidate causes — please determine which (this changes the fix)
1. **Missing app-side refresh** — the bulk action completes but no `refresh()` is triggered, and AppHeader isn't re-mounted by a tab-style navigation ⇒ badge stays as last fetched. **Fix:** trigger a refresh from the bulk action.
2. **Realtime UPDATE event never arrives** — if the `user_notifications` UPDATE subscription isn't actually delivering (table not in the publication, REPLICA IDENTITY not carrying the filter column, or the channel erroring), the hook's "refresh on update" is dead code and **this bug is a symptom of a broader broken-badge problem** that also affects single-item reads.

   *Diagnostic:* instrument the hook's Realtime callback, or open two sessions and confirm whether a single marked-read notification updates the badge live. If the channel errors, the `CHANNEL_ERROR`/`TIMED_OUT` warning is already logged — check the device log for `[useNotificationBadge] Realtime update channel status:`.

### Proposed fix
- **Preferred (robust, cause-independent):** make the badge authoritative rather than push-dependent —
  - expose a shared refresh trigger (a tiny event emitter / context, or the hook's `refresh` via a module-level pub-sub) and call it from `handleMarkAllRead` **and** `handleRefresh` **after** the write resolves; **and**
  - refetch on screen focus / app foreground as a safety net, so a missed Realtime event self-heals instead of persisting until the next mount.
- Also verify/repair point 2 above — if the Realtime channel is broken, fix that too, since other badge consumers depend on it.

### Acceptance criteria
- After **Mark all read**, the header bell badge clears (no badge, or `0`) **within the same interaction**, without needing an app restart or a screen change.
- Single-notification reads (tapping one row) keep the badge in sync.
- Pull-to-refresh on the Notification Center also reconciles the badge.
- Badge count still equals the true unread count on cold start (the mount-time path must not regress).

### How to re-verify
1. Seed/accumulate a large unread count (>99 so the `99+` cap is unmistakable).
2. Open Notifications → `Mark all read`.
3. Assert the badge clears; cross-check `SELECT count(*) … AND is_read=false;` = 0.
4. Restart the app and confirm the badge is (still) absent — proving the mount path agrees.

---

## Notes for the dev picking this up
- **Nothing was changed by QA** — no source, test, seed or config file was touched. The repo is as QA found it; only the run folder + the tracker's MSG section were added.
- **Related but NOT part of this task** (still open, all documented in the run report): **F3** floating Sell FAB occludes the last section's `Save Quiet Hours` button · **F4** header chat badge (`1`) disagreed with the list (9 unread across 7 conversations) — observation, not reconciled · **F5** copy gaps · **F6** the Android keyboard overlays the Chat input bar (`ChatScreen.tsx:857-860` uses `behavior: undefined` on Android; no `windowSoftInputMode` declared; API 36 edge-to-edge) — **F3 and F6 look like the same root class (missing inset handling on API 35+) and are worth fixing together in a follow-up.**
