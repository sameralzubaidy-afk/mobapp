# Dev Task 95 — MSG Follow-Ups: Linking Config, Doc Drift, UX Copy

**Date:** 2026-09-03
**Scope:** 4 small, low-risk items from MSG's first live execution round. No money-adjacent code; no live-verification gate beyond a quick deep-link Tier-1 check.
**App:** `p2p-kids-marketplace` · **Guide:** `cross-checked-and-consolidated/MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md`

---

## Changes

### Item 1 — Deep-link paths added to `AppNavigator` linking config (Leaderboard excluded)

**File:** `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` (`linking.config.screens`)

Added raw deep-link path entries:
- `Badges: 'badges'`
- `ReferralDashboard: 'referrals'` (the Referrals screen's registered route name)
- `Chat: 'chat/:tradeId'` (Chat requires a `tradeId` route param)
- `TradeList: 'trades'`

**Notes / discrepancies vs. the task + QA premise:**
- **`SpWallet: 'sp-wallet'` was ALREADY present** in the linking config (since 2026-05-14, commit `f7b1b5107`). The QA finding ("no SpWallet path") and the task premise ("missing path entries for … SpWallet") were **inaccurate on this point** — no duplicate entry was added (a duplicate key would be pointless). Verified live: `p2pkidsmarketplace://sp-wallet` navigates.
- **`Leaderboard` intentionally NOT added** — deferred post-MVP per product decision; it stays unreachable by deep link (matches its existing lack of an in-app nav entry). Verified live: `p2pkidsmarketplace://leaderboard` does not navigate.

### Item 2 — Guide doc-fix: MSG-TC-C06 `Dependencies` corrected

**File:** MSG guide, MSG-TC-C06 section (Locator hints + Dependencies).

Changed "Report confirmation is native `Alert.alert`" → the confirm renders via the in-app **`GlobalAlertProvider`** branded modal (buttons `global-alert-button-0` = Cancel, `global-alert-button-1` = Report). Root cause of the doc drift: `ReviewCard.tsx` calls `Alert.alert('Report Review', …)`, but `GlobalAlertProvider` globally patches `Alert.alert` so every call renders through its branded queue. Doc corrected 2026-09-03; header `Last updated` line updated.

### Item 3 — Guide: MSG-TC-B05 marked DEFERRED (post-MVP)

**File:** MSG guide — header, Test Case Index row, case body, and Verification checklist mapping row.

MSG-TC-B05 (Leaderboard ranking) marked **🚫 DEFERRED (post-MVP)** — out of scope for QA rounds until Leaderboard is prioritized; do not treat reachability as a defect or re-flag it. The underlying reachability finding is retained in the case body for when/if Leaderboard is picked up later (the linking-config gap — no `Leaderboard: 'leaderboard'` path — will need addressing then). Same treatment as ACC Group K (MFA), adapted to DEFERRED rather than NOT-IMPLEMENTED (Leaderboard's screen exists but is deferred).

### Item 4 — UX copy: Notification Preferences in-app sub-label

**File:** `p2p-kids-marketplace/src/screens/profile/NotificationPreferencesScreen.tsx`

Changed the In-App channel sub-label from "Show badges inside the app" → **"Show alerts inside the app"** (the channel covers all notification types, not just badges).

---

## Tier 0 (compile/lint gate) — PASS

- `yarn typecheck` (`tsc -p tsconfig.json --noEmit`) → **PASS** (Done in 9.13s, exit 0)
- `npx eslint src/navigation/AppNavigator.tsx src/screens/profile/NotificationPreferencesScreen.tsx` → **PASS** (exit 0)
- Jest navigation tests (`AppNavigatorOnboardingTabBar`, `AppNavigatorTabBarNavigation`) → **PASS** (11/11)

## Tier 1 — live deep-link check (simulator, iPhone 17 Pro Max UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`)

Relaunched app (updated bundle) as test-buyer, then fired each deep link via `xcrun simctl openurl` and confirmed navigation via OCR:

| Deep link | Result |
|---|---|
| `p2pkidsmarketplace://badges` | ✅ navigates → **My Badges** |
| `p2pkidsmarketplace://referrals` | ✅ navigates → **Referrals** |
| `p2pkidsmarketplace://trades` | ✅ navigates → **My Trades** |
| `p2pkidsmarketplace://sp-wallet` | ✅ navigates → **Swap Points** (pre-existing entry, confirmed) |
| `p2pkidsmarketplace://chat/943097a5-89bd-4361-9525-d1a1689682b9` | ✅ navigates → **Chat** (active in-progress trade) |
| `p2pkidsmarketplace://leaderboard` | ✅ correctly does **NOT** navigate (stayed on Chat) — deferred post-MVP |

**Evidence screenshots:** `e2e-test-results/dev-task-95-msg-followups-2026-09-03/screenshots/` (`dt95-deeplink-badges.png`, `-referrals.png`, `-trades.png`, `-spwallet.png`, `-chat.png`, `-leaderboard.png`, `dt95-launch-state.png`).

**Read-only DB used (Tier 1 fixture resolution only):** identified test-buyer (`49243010-f458-4744-add1-a6c84ab95f1f`) and an in-progress trade with a message thread (`943097a5-89bd-4361-9525-d1a1689682b9`, "Cash-Only Item") to drive the Chat deep link. No mutations.

---

## App State Left Behind

- App left logged in as test-buyer (session restored on relaunch — pre-existing state, not created by this task).
- No test data created, no config changed, no DB mutations.
- Guide + source edits only.
