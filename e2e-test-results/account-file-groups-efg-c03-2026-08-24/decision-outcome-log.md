# Decision-and-Outcome Log — Groups E+F + C03 Closure + Group G (Account File)

**Run:** `e2e-test-results/account-file-groups-efg-c03-2026-08-24/`
**Date:** 2026-08-24, 23:07–23:44 UTC (~37 min active)
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (Groups E/F/G)
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1), Expo RN dev build + Metro, staging
**Personas:** throwaway (E, created & deleted), test-buyer, test-free, test-seller, qa-linked-provider (C03/G10)
**Verdict roll-up:** 12 PASS / 2 FAIL / 7 BLOCKED / 0 SKIPPED (21 cases)

This log is the action → reasoning → tool-call → outcome trace focused on the decisions that shaped the run (persona batching, the C03 root-cause hunt, the DeleteAccount scroll-stuck workaround, and the doc-drift findings).

## 1. Execution trace (highlights)

### Pre-flight (source+DB prediction pass — the highest-leverage step)
- Read playbook §4–§9 + repo memory; read Group E/F/G bodies + Accounts table from the canonical guide.
- **DB probes (read-only) predicted 5 blockers before any device time:** `test-suspended`/`test-trial`/`test-grace` DO NOT exist; `unsubscribe_tokens` empty; `request_account_deletion` + `process_unsubscribe` RPCs exist; test-buyer resolves to status `active` (not grace); test-seller `trial` at 8 days (no trial banner); qa-linked-provider fixture present with Google identity + 3 methods; no persona has `payment_failed_at`; all personas id-verif `none`.
- **Source reads:** DeleteAccountScreen (5 consequences + `request_account_deletion` RPC + logout), SuspendedAccountScreen/gate (`account_status==='suspended'` from profiles), UnsubscribeScreen (auth-gated route, `process_unsubscribe`), OfflineScreen (orphaned route), UserDashboardScreen (banner structure, tiles, greeting dead code, MAX_VISIBLE=3), `getSubscriptionSummary`, `getTrialReminderMessage` (7/2/1-day thresholds), `unlinkSocialAccount` (countLoginMethods → unlinkIdentity → audit).

### Group E (throwaway signup)
- DEV autofill → phone verify (DEV bypass 123456) → profile setup → onboarding Skip → Home. **Friction:** the autofill buttons/submit sit at tree-y >956 (below the fold) — the first two autofill taps landed off-screen (no-op). Scroll down first, then tap.
- **E01 PASS** (screen + 5 consequences + password gate). **E02 PASS** (wrong password → "Incorrect password" alert; DB-closed no deletion). **E03 PASS** (correct password → final confirm → Delete → auto-logout; DB-closed: profile `deletion_type='self'`, wallet `frozen`, audit in `admin_activity_log`).
- **KEY FRICTION discovered:** focusing the DeleteAccount password field triggers a scroll-stuck state (buttons below fold, 0-changed-px swipes). Worked around by: remount (back→re-enter) + swipe from explicit start `(220,350)` up 350 + pixel-scan the `#E85D75` band. This recurred on every field focus.

### Group F
- **F02 error leg executed** (login test-buyer → deep link with invalid token → "Unable to Unsubscribe" + "Invalid or expired token" + Go to Home → PASS). Valid leg BLOCKED (no token, execution-only cannot write).
- **F01/F04 BLOCKED** (no suspended persona; only suspended user has unknown password). **F03 BLOCKED** (Offline orphaned — no trigger/deep link; both Unsubscribe and Offline are auth-gated).

### C03 fixture closure — FAIL, root cause found via CDP
- Fixture confirmed (Google "Linked", methods:3) → Unlink → confirm → **Error** "Failed to unlink google account. Please try again." (3 consistent attempts).
- **Investigation path:** (1) DB: google identity still present, no audit row → failure precedes audit write; (2) source: `unlinkSocialAccount` reaches `supabase.auth.unlinkIdentity`; (3) query-log tool down (backend error); (4) CDP capture attempt #1 failed — **attaching the Hermes inspector triggered an app reload → caught only a replay burst** (§5.12 trap); (5) wrote a **reconnect-capable capture** (re-poll `/json`, re-attach on socket close), retried → captured the exact error: **"Failed to unlink identity: Manual linking is disabled"**.
- Conclusion: backend-config blocker (Manual Linking off on staging), not a fixture/app-UI defect. Documented as a one-toggle ops fix; fixture left intact for re-run.

### Group G (persona-batched: test-buyer → test-free → test-seller → qa-linked-provider)
- G01: greeting dead code confirmed (no greeting renders; badge "Kids Club+ Active" + "46 SP" pass) → FAIL.
- G03/G05/G11/G12 on test-buyer (tiles, carousel+trade card, View Timeline, See All→Discover) — PASS.
- G06 pull-to-refresh — PASS (RefreshControl source-verified; spinner transient, image-capture inconclusive).
- G04/G08/G13 on test-free (ID CTA dismiss, free SP strip→Kids Club+, Upgrade→Kids Club+) — PASS.
- G02 on test-seller: draft banner PASS; grace/payment-fail/trial legs not inducible; **guide ordering ≠ source** (doc drift) → BLOCKED.
- G10 on qa-linked-provider (0 trades → "No active trades right now") — PASS (batched with C03).
- G07/G09 BLOCKED (dead-code paths: show-more never renders; no-session fallback unreachable).

## 2. Bottlenecks (ranked by wall-clock)
1. **DeleteAccount scroll-stuck on field focus** (~4 min cumulative): every focus hides the buttons; workaround = remount + explicit-start swipe + pixel-scan. Biggest friction of the run.
2. **C03 root-cause hunt** (~6 min): query-log tool down + CDP reload trap → needed a reconnect-capable capture to get the one-line GoTrue error.
3. **Signup below-fold autofill miss** (first two taps no-op'd) — fixed by scrolling first.
4. Auth cycles (5 logins/5 logouts) — mitigated by persona batching (G batched onto 3 personas + C03/G10 shared).

## 3. Proactive patterns that worked
1. Source+DB prediction pass flagged 5 of 7 blockers pre-device (F01/F04, F02-valid, F03, G02-legs, G07, G09).
2. DB-closed every persistence/destructive assertion (E02 no-delete, E03 delete side-effects, C03 identity/audit) — never trusted UI alone.
3. Empirical dialog verification (all in-app GlobalAlertProvider; guide's "native Alert.alert" labels = doc drift on E03).
4. CDP reconnect-capture recipe to beat the reload/replay trap — captured a decisive one-line error.
5. Persona-protective: E03 on a throwaway only; C03 fixture left untouched (unlink failed, so no mutation).

## 4. Instrumentation / fixture work that would remove friction
1. **(Highest) Ops: enable Manual Linking** in staging Supabase Auth → C03 unlinks succeed (and real linking works).
2. Provision `test-suspended@…` (F01/F04), a valid `unsubscribe_tokens` row (F02-valid), a grace persona + timed-trial persona (G02 legs).
3. App: render the Home greeting (G01), reconcile G02 banner ordering with the guide, add a 4th CTA type or drop G07's show-more, decide Offline route wiring (F03).
4. Investigate the DeleteAccount keyboard-focus scroll-stuck (KeyboardAvoidingView offset persists after dismiss) — recurring interaction defect that inflated test time.
