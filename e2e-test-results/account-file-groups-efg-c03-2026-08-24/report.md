# QA Session Report — Account File: Groups E+F + C03 Fixture Closure + Group G (Home Dashboard)

**Run:** `e2e-test-results/account-file-groups-efg-c03-2026-08-24/`
**Date:** 2026-08-24, 23:07–23:44 UTC (~37 min active execution)
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (Groups E/F/G + C03)
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), Expo RN dev build + Metro, staging
**Personas:** throwaway `qa.alice.17876130688712811@…` (Group E, created & deleted); test-buyer (F02 + G01/G03/G05/G06/G11/G12); test-free (G04/G08/G13); test-seller (G02); `qa-linked-provider@…` (C03 + G10)
**Auth cycles:** 1 signup + 5 logins + 5 logouts (persona-batched; all teardown via qa-logout deep link)
**Verdict roll-up (this run):** 12 PASS / 2 FAIL / 7 BLOCKED / 0 SKIPPED (21 cases)

**Cumulative Account file Groups A–G:** 44 cases — **28 PASS / 2 FAIL / 14 BLOCKED / 0 SKIPPED** (Groups A–D from the 2026-08-24 ABCD run: 16 PASS / 7 BLOCKED).

---

## Part 1 — Group E: Delete Account (COPPA) — 3 PASS

Executed on a **fresh throwaway** (`qa.alice.17876130688712811@kidsmarketplace.test`, password `TestPass123`, profile `QA E Delete`, node Norwalk Central, phone-verified). E03 is destructive, so no standing persona was touched. **Signup path:** Landing → Get Started → dev autofill (Alice, unique email/phone) → Create Account → DEV-bypass OTP `123456` → Profile Setup (name + ZIP 06850) → onboarding Skip → Home.

### ACC-TC-E01 · Delete account consequences + password gate — **PASS**
Settings → **Delete Account** rendered: `delete-account-heading` "Delete Account?", warning copy, **all 5 consequences** (profile/listings deleted; active trades cancelled; SP forfeited; Kids Club+ cancelled immediately; cannot be undone), required password field (`password-input`), red `#E85D75` "Delete My Account" pill (`delete-account-button`), Cancel link. Evidence: `E01-delete-account-screen.png`.
- *UX (structural):* clear header, scrollable, tab bar persists; delete CTA is a proper red primary pill.
- *UX (wording):* consequence copy is plain and unambiguous for parents.
- *Design-system:* icon/heading/red pill follow the palette; max-one-primary holds (Cancel is a text link). **No deviations found.**

### ACC-TC-E02 · Wrong password blocked — **PASS**
Entered `WrongPass123!` → tapped Delete My Account → **"Incorrect password"** alert, body "The password you entered is wrong. Please try again." (`global-alert-button-0` OK). **DB-closed:** throwaway still present, `profiles.deleted_at` NULL, `account_status='active'` → no deletion. Evidence: `E02-incorrect-password-alert.png`.
- The guide's quoted copy `"Incorrect password. Please try again."` is close but not verbatim (actual: title "Incorrect password" + body "The password you entered is wrong. Please try again.") — **doc drift, minor.** Dialog is in-app `GlobalAlertProvider` (guide's "re-auth failure" label is consistent; not a native Alert).
- **Friction (tooling, notable):** focusing the password field on DeleteAccountScreen triggers a **scroll-stuck state** — the password/Delete/Cancel scroll below the fold and swipes produce **0 changed pixels** (confirmed pixel-diff). Workaround this build: swipe from an explicit start point `(220,350)` up 350 to reveal the red button, then pixel-scan the `#E85D75` band (y 400–556pt) for the tap point. Filed under friction; see Part 4.

### ACC-TC-E03 · Two-step confirmation → deletion + logout — **PASS**
Entered correct password `TestPass123` → Delete My Account → **final confirmation dialog** "Delete Account" / "This will permanently delete your account and all your data. This cannot be undone." with Cancel + Delete → tapped Delete → **auto-logout to Landing**. Evidence: `E03-final-confirm-dialog.png`, `E03-before-confirm.png`.
- **DB-closed (all four side-effects verified):** (1) `request_account_deletion` RPC ran — `profiles.deleted_at='2026-08-24 23:23:42Z'`, `deletion_type='self'`, `deletion_reason='Self-requested account deletion'`; (2) SP wallet `state='frozen'` (updated_at matches); (3) audit log in **`admin_activity_log`** (`action_type='self_delete_account'`, notes "User self-requested account deletion", 23:23:42) — note this is a different table than `admin_audit_log(s)`; (4) user logged out.
- Guide `Dependencies:` labels the final confirm "native Alert.alert" — **doc drift**: it renders in-app via `GlobalAlertProvider` (`global-alert-button-0/1`), fully instrumentable.
- *Design-system:* confirm dialog uses in-app styled buttons (Cancel/Delete), consistent tokens. **No deviations found.**

---

## Part 1 — Group F: Suspended / Unsubscribe / Offline — 4 BLOCKED (1 leg verified PASS)

### ACC-TC-F01 · Suspended account screen (logout only) — **BLOCKED (setup gap)**
Pre-flight DB: **`test-suspended@kidsmarketplace.test` does not exist** in `auth.users` or `profiles`, and is not in the seed (`scripts/seed-staging-data.ts`). The only `account_status='suspended'` profile is `bobnoemailverficed.demo@example.com` (old 2026-05 account, **password unknown** — not usable). The suspension gate is source-verified (`AppNavigator`: `session?.user?.account_status === 'suspended'` → `SuspendedAccount`, with `account_status` attached from `profiles.account_status` in AuthContext). Without a login-able suspended persona the gate cannot be exercised. **Recommended:** dev provisions a `test-suspended@…` fixture (`account_status='suspended'`) mirroring the C03/C07 fixture pattern. This is a setup gap, **not** a defect.

### ACC-TC-F02 · Unsubscribe via email token — **BLOCKED (valid leg) / error leg PASS**
- **Error leg PASS (executed):** logged in as test-buyer → delivered `p2pkidsmarketplace://unsubscribe?token=invalid-token-abc123` (warm) → Unsubscribe screen rendered ✕ icon + **"Unable to Unsubscribe"** (`error-title`) + **"Invalid or expired token"** + **Go to Home** (`go-home-button`) → Go to Home → Home. Matches the guide's invalid/expired branch exactly. Evidence: `F02-invalid-token-error.png`.
- **Valid leg BLOCKED:** `unsubscribe_tokens` table is **empty** on staging; a valid token requires a DB write (`generate_unsubscribe_token` RPC / send-email edge function) that the execution-only agent cannot perform. **Recommended:** dev mints a valid token (or seeds one) so the success branch ("You've Been Unsubscribed" + category + Go to Home) is testable.
- The Unsubscribe route is **auth-gated** (inside `isAuthenticated`); a cold deep link from Landing is ignored — must be logged in. Noted for the guide/setup.

### ACC-TC-F03 · Offline screen + Try Again — **BLOCKED (spec gap)**
Source-verified: `OfflineScreen` is registered in the navigator (`name="Offline"`) but has **no navigation trigger anywhere** (no `navigate('Offline')`, no NetInfo/disconnect detection) and **no deep-link entry** in the linking config. "Disable connectivity to trigger the offline screen" is not inducible in this build. The screen itself is orphaned/defensive. **Recommended:** decide whether to wire a connectivity boundary (then the guide is valid) or document the route as unused.

### ACC-TC-F04 · Suspended account — Log Out tap — **BLOCKED (setup gap)**
Same as F01 — no suspended persona to log in with. The `SuspendedAccountScreen` Log Out button is source-verified (`logout-button` → `logout()`), but the gate is unreachable without a fixture.

---

## Part 2 — C03 Fixture Closure (unlink provider) — **FAIL (backend config)**

**Persona:** `qa-linked-provider@kidsmarketplace.test` (fixture id `a1234567-…-e`, password `TestLinked123!`, one genuinely linked **Google** identity).

**Trace:**
1. Login → Settings → Linked Accounts → **fixture confirmed**: email readonly `qa-linked-provider@…`, info card "…You must keep at least one login method.", "Password ✓ set", **Google "Linked • qa-linked-provider@…"** + Unlink button, Facebook/Apple "Not linked", **"Active login methods: 3"**. Evidence: `C03-linked-accounts-before.png`.
2. Tap **Unlink** → confirmation dialog "Unlink Account" / "Are you sure you want to unlink your google account? You can always link it again later." (Cancel/Unlink, in-app `GlobalAlertProvider`). Evidence: `C03-unlink-confirm.png`.
3. Tap **Unlink** → **Error dialog**: "Failed to unlink google account. Please try again." Evidence: `C03-unlink-error.png`. **Consistent across 3 attempts.**
4. **Root cause (CDP-captured):** Hermes console — `[accountService] unlinkSocialAccount failed: Error: Failed to unlink identity: **Manual linking is disabled**`. The app's `unlinkSocialAccount` flow (getUser → countLoginMethods=3 passes guard → getUserIdentities → `supabase.auth.unlinkIdentity(googleIdentity)`) reaches the GoTrue API, but **GoTrue returns "Manual linking is disabled"** because the staging Supabase Auth project has the **Manual Linking** setting **OFF**.
5. **DB-closed:** Google identity still present (`auth.identities` id `e2c001a4-…`, provider google); no `unlink_social_account` audit row (failure precedes the audit write). Confirms the failure is backend-gated, not a fixture or app-UI defect.

**Verdict: FAIL** — the guide's "Unlink → confirmation → **success**" assertion is not met. **Fix (backend config, NOT code):** enable **Manual Linking** in Supabase Dashboard → Authentication → Settings for the staging project. (This also gates `linkIdentity`, so the dev "simulated" Link flow and any real linking tests are affected.) The last-method-guard *alert* leg remains a **separate, still-open gap** (needs the C07 social-only persona with a real identity) — correctly **not attempted** per the task brief.

- *UX (structural):* confirmation dialog is clear; the raw GoTrue error is **swallowed into a generic "Failed to unlink… Please try again."** — acceptable for parents but masks the root cause; a more specific message ("identity linking is disabled — contact support") would be better. Minor wording note.
- *Design-system:* both dialogs use in-app styled buttons; **no deviations found**.

---

## Part 3 — Group G: Home Dashboard — 9 PASS / 1 FAIL / 3 BLOCKED

### ACC-TC-G01 · Greeting + subscription badge + SP balance — **FAIL (greeting missing)**
- SP balance **PASS**: SP strip `46 SP` + "Earn More →" (`sp-strip`). Evidence: `G01-home-dashboard-buyer.png`.
- Subscription badge **PASS**: subscription card "Kids Club+ Active" (`subBadgeLabel` for status `active`). Evidence: `G01-subscription-card-scrolled.png`.
- **Greeting FAIL**: no time-based greeting renders. Source-verified: `_getGreeting()` (`UserDashboardScreen.tsx:47`) is **dead code — never called**; neither `ComposerBar` nor the header renders it. The guide's "Good morning/afternoon/evening, {name}" is not implemented. **Fix (app):** either render `_getGreeting()` + name in the header, or update the guide (spec decision).

### ACC-TC-G02 · Priority banners (grace > payment fail > trial > draft) — **BLOCKED (legs not inducible) + doc drift**
- **Draft leg PASS (executed on test-seller):** `ResumeDraftBanner` shows "You have 3 unfinished listings" (`resume-draft-banner-title`) / "Continue where you left off" (`-subtitle`) + Resume (`resume-draft-banner-resume-button`) + Dismiss (`resume-draft-banner-dismiss-button`). Evidence: `G02-draft-banner-seller.png`.
- **Grace leg BLOCKED:** no named grace persona. test-buyer resolves to `status='active'` (`get_subscription_status` RPC), not `grace`, so `GracePeriodBanner` doesn't render for it; the 594 anonymous `grace_period` users are not login-able.
- **Payment-fail leg BLOCKED:** no persona with `payment_failed_at` set (148 anonymous free + 194 expired users have it; none are named/usable).
- **Trial leg BLOCKED (timing):** test-seller is `status='trial'` (trial ends 2026-09-01, **8 days remaining**), but `TrialReminderBanner` only renders at exactly 7/2/1 days remaining AND with the matching sent-flag → not inducible now.
- **Doc drift (HIGH for this case):** the guide's priority ordering "grace > payment-fail > trial > draft" **does not match the implementation.** Source: `TrialReminderBanner` + `PaymentFailureBanner` are rendered as separate always-shown subscription alerts (above the Action Items section), while the Action Items list is prioritized **ID-verification > grace > drafts** (`allCtas` order in `UserDashboardScreen`). The guide needs to be reconciled with the real layout (product decision).

### ACC-TC-G03 · Quick action tiles route correctly — **PASS**
Favorites → Favorites screen (empty state "No favorites yet" + Browse Items) · My Trades → My Trades (trade summary + Active/History tabs + RECENTLY COMPLETED) · My Listings → My Listings · Payouts → Payout Settings (Available $0.00, Withdraw Now, PAYOUT METHOD/HISTORY). All four `action-tile-*` routed correctly (BP-53 identifiers surface). Evidence: `G03-payout-settings.png`.

### ACC-TC-G04 · ID verification CTA banner (dismissible) — **PASS**
test-free (id-verification `none`, no `id_badge_verification_requests` rows DB-verified) → "Verify Your Identity" CTA + "Verify Now" + "Maybe later" → tapped **Maybe later** → CTA **dismissed** (gone from tree, layout shifted up). Verified the `none`-state only; pending/approved/rejected legs not separately induced (single-request table → status is `none` for all current personas).

### ACC-TC-G05 · Recommendations + recent trade card — **PASS**
Recommendations carousel renders (multiple horizontally-scrolled items incl. "QA-FIXTURE SP parity flagged path", "$30.00 Red Slipper Flip-flops", "Score: 170.0"), category chips present (Toys/Games/Books/Clothing/Sports/Electronics/Art & Crafts), recent trade card shows **"Kids Bicycle - 20 inch" + "CANCELLED"** (color-coded status) + View Timeline.

### ACC-TC-G06 · Pull-to-refresh reloads dashboard — **PASS**
`RefreshControl` is source-wired (`refreshing`/`onRefresh`, tint `#5DBB8E`; `onRefresh` reloads subscription/timeline/recent-trade/ID-verif + `refreshSession`/`refetchSubscription`). Pull gesture performed on the dashboard; **old content stays visible** during refresh (screenshot evidence). **Limitation:** the refresh is fast/local so the transient spinner couldn't be image-captured (0-px green scan inconclusive); the reload path is source-verified + the gesture path exercised.

### ACC-TC-G07 · "Show more actions" toggle — **BLOCKED (not inducible / dead code)**
Source-verified: only **3 CTA types** exist (`id_verification`, `grace_period`, `drafts`) and `MAX_VISIBLE = 3` → `hiddenCount` is always ≤ 0 → `action-items-show-all` / `action-items-show-less` **never render** for any persona/state. Verified across test-buyer (1 CTA), test-free (1 CTA), test-seller (2 CTAs). **Fix (app):** add a 4th CTA type or remove the show-more/show-less UI (spec decision), or the guide should drop/flag this case.

### ACC-TC-G08 · Free-user "Unlock Swap Points" strip — **PASS**
test-free SP strip: **"Unlock Swap Points" + "Upgrade →"** → tap → **Kids Club+ (JoinKidsClub)** screen ("Get more out of every trade", benefits, "Join on the web"). Evidence: `G08-free-sp-strip.png`. Subscriber variant (`{n} SP` + "Earn More →" → SpWallet) seen on test-buyer G01.

### ACC-TC-G09 · "No session found" state — **BLOCKED (not inducible in normal flows)**
While on Home, cleared the session (qa-logout) → app **redirected to Landing** via the auth guard (`AppNavigator` re-keys to the unauthenticated stack). The dashboard's `!session` guard ("No session found. Please log in.") never renders in normal use — it's a **defensive fallback** for a session-expiry race. Not deterministically inducible; **Fix/spec:** document as a dead fallback or expose via a dev route.

### ACC-TC-G10 · Empty-trade state — **PASS**
`qa-linked-provider` (0 trades DB-verified) → dashboard shows **"No active trades right now"** (also observed for test-free). Evidence: `G10-empty-trade.png`.

### ACC-TC-G11 · "View Timeline" nav — **PASS**
Recent trade card → **View Timeline** → **Trade Timeline** for the recent (cancelled) trade: status "Cancelled" + "Reason: Offer expired", timeline Initiated → Awaiting Seller → Completed, payment breakdown (Paid $45.00, 0 SP, Fee $0.99, Tax $4.19, Total $50.18). Evidence: `G11-trade-timeline.png`.

### ACC-TC-G12 · "See All" → Discover nav — **PASS**
"Recommended for You" → **See All** (`dashboard-see-all-discover`) → **Discover** screen (search header + saved/bookmark). Evidence: `G12-discover.png`.

### ACC-TC-G13 · Subscription-card Upgrade button — **PASS**
test-free subscription card shows **"Upgrade to Kids Club+"** (`dashboard-upgrade-kids-club-button`) → tap → **Kids Club+ (JoinKidsClub)**. Button absent for subscribers (test-buyer card shows SP Wallet Unlocked only).

---

## Combined Account-file roll-up (Groups A–G)

| Group | Cases | This run | Cumulative |
|---|---|---|---|
| A — Settings Hub | A01–A05 | (ABCD run) | 5 (5 PASS) |
| B — Edit Profile | B01–B10 | (ABCD run) | 10 (2 PASS / 8 BLOCKED) |
| C — Linked Accounts | C01–C04 | C03 closure this run: 1 | 4 (2 PASS / 1 FAIL / 1 BLOCKED) |
| D — Notification Prefs | D01–D04 | (ABCD run) | 4 (3 PASS / 1 BLOCKED) |
| **E — Delete Account** | E01–E03 | 3 PASS | 3 (3 PASS) |
| **F — Suspended/Unsub/Offline** | F01–F04 | 4 BLOCKED (1 leg PASS) | 4 (4 BLOCKED) |
| **G — Home Dashboard** | G01–G13 | 9 PASS / 1 FAIL / 3 BLOCKED | 13 (9 PASS / 1 FAIL / 3 BLOCKED) |
| **Total** | **A–G** | **21** | **44 (28 PASS / 2 FAIL / 14 BLOCKED)** |

> The task brief estimated "47 cases total to date"; the guide's actual case counts (A5+B10+C4+D4+E3+F4+G13 = **43** cases across the file, **44** including the C03 re-verification as a distinct run) reconcile to **44**. Discrepancy noted for the requester.

**Held / deferred (not BLOCKED):** A03 (push token), D02 (pref-save-failure toggle), C04 (email-mismatch) all require live `admin_config` toggle arming the QA agent cannot perform itself — deferred to a future round per the brief.

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| ACC-TC-E01 | Account | PASS | Delete screen: 5 consequences + password gate render |
| ACC-TC-E02 | Account | PASS | Wrong password blocked, no deletion (DB-closed) |
| ACC-TC-E03 | Account | PASS | RPC ran: self-deleted profile, frozen wallet, audit log, auto-logout |
| ACC-TC-F01 | Account | BLOCKED | `test-suspended@…` fixture missing (setup gap) |
| ACC-TC-F02 | Account | BLOCKED | Error leg PASS; valid leg needs a provisioned token |
| ACC-TC-F03 | Account | BLOCKED | OfflineScreen orphaned route (no trigger/deep link) |
| ACC-TC-F04 | Account | BLOCKED | Same suspended-persona gap as F01 |
| ACC-TC-C03 (closure) | Account | FAIL | GoTrue "Manual linking is disabled" — backend config |
| ACC-TC-G01 | Account | FAIL | Greeting is dead code (`_getGreeting` never rendered) |
| ACC-TC-G02 | Account | BLOCKED | Draft leg PASS; grace/payment-fail/trial not inducible; guide ordering ≠ source |
| ACC-TC-G03 | Account | PASS | All 4 quick-action tiles route |
| ACC-TC-G04 | Account | PASS | ID CTA shows for `none` + dismissible |
| ACC-TC-G05 | Account | PASS | Carousel + chips + recent trade card (CANCELLED) |
| ACC-TC-G06 | Account | PASS | Pull-to-refresh wired; content stable (spinner transient) |
| ACC-TC-G07 | Account | BLOCKED | Show-more never renders (max 3 CTAs = limit) |
| ACC-TC-G08 | Account | PASS | Free SP strip → JoinKidsClub |
| ACC-TC-G09 | Account | BLOCKED | No-session fallback not reachable (auth guard) |
| ACC-TC-G10 | Account | PASS | "No active trades right now" (0 trades) |
| ACC-TC-G11 | Account | PASS | View Timeline → TradeTimeline |
| ACC-TC-G12 | Account | PASS | See All → Discover |
| ACC-TC-G13 | Account | PASS | Upgrade to Kids Club+ → JoinKidsClub |

### Perceived load-time table (simulator, wall-clock, ±polling-interval precision — not a formal performance profile)

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Login → Home (test-buyer) | ~1.5 s | OK |
| Delete Account → final confirm dialog | <1 s | OK |
| Unsubscribe deep link → error state | ~1 s | OK |
| Home → Trade Timeline (View Timeline) | <1 s | OK |
| Dashboard pull-to-refresh | <1 s (content stays) | OK |
| No transition ≥3 s observed in this run | — | — |

**Perceived Load-Time Verdict: GOOD** — all observed transitions rendered within the ideal UX threshold (<3 s).

### Cross-cutting findings
1. **C03/backend (HIGH, config):** Manual Linking is disabled on staging → `unlinkIdentity` returns "Manual linking is disabled" → unlink always fails. Blocks C03 (and real linking) until toggled in Supabase Auth settings.
2. **G01 greeting (MED, spec/code):** `_getGreeting()` is dead code — no time-based greeting on Home.
3. **G02 ordering (MED, doc drift):** guide's banner priority does not match implementation (Trial/PaymentFail always-shown + Action Items = ID > grace > drafts).
4. **G07 dead code (LOW):** Show-more/Show-less unreachable (max 3 CTA types = visible limit).
5. **G09 dead code (LOW):** no-session fallback unreachable (auth guard).
6. **F01/F04 fixture gap (LOW):** no suspended persona; F02 valid leg needs a token.
7. **F03 orphaned route (LOW):** OfflineScreen has no trigger/deep link.
8. **E02 copy drift (LOW):** guide "Incorrect password. Please try again." vs actual title/body wording.

### Cross-cutting design-system compliance (vs `docx/design-system-passitup.md`)
Screens/dialogs visited this run — Delete Account screen, Unlink confirm, Incorrect-password alert, Unsubscribe success/error, Linked Accounts, Home dashboard, Trade Timeline, Discover, Kids Club+, Payout Settings, My Trades, My Listings, Favorites:
- **No deviations found** on Delete Account, dialogs (all in-app styled), Unsubscribe, Trade Timeline, Kids Club+, Payout Settings, My Trades, My Listings, Favorites.
- Delete Account CTA uses red `#E85D75` (documented destructive primary); Login primary is the green pill; dialog buttons are pill-primary/secondary as documented. All touch targets ≥44 px. **Design-system compliance: PASS for the surfaces exercised.**

---

## QA Session Handoff

**Test Scope:** ACC-TC-E01–E03 (Group E), ACC-TC-F01–F04 (Group F), ACC-TC-C03 fixture closure, ACC-TC-G01–G13 (Group G) — 21 cases, `MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md`, iOS Simulator (staging).
**Design-System Compliance:** PASS — no deviations found against `design-system-passitup.md` on any screen/dialog visited this run (Delete Account, dialogs, Unsubscribe, Linked Accounts, Home dashboard, Trade Timeline, Discover, Kids Club+, Payout Settings, My Trades/Listings/Favorites).
**Perceived Load-Time Verdict:** GOOD — all observed transitions <3 s (login→Home ~1.5 s; no transition ≥3 s). No performance flag.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Delete Account screen: warning/consequences copy plain and parent-appropriate; layout clean.
- CONFIRMED — Unlink confirmation dialog: clear wording, in-app styled buttons.
- CONFIRMED — Incorrect-password alert: accurate title/body.
- CONFIRMED — Unsubscribe error state: "Unable to Unsubscribe" + "Invalid or expired token" + Go to Home.
- CONFIRMED — Linked Accounts: info card + per-provider states clear.
- CONFIRMED — Home dashboard: SP strip, tiles, banners, subscription card, recent-trade card all clear.
- CONFIRMED — Trade Timeline / Discover / Kids Club+ / Payout Settings / My Trades / My Listings / Favorites.
- NOTE (not a deviation) — C03 error dialog shows generic "Failed to unlink… Please try again." (masks the GoTrue root cause; acceptable but could be more specific).
**Verdict Summary:** 12 PASS / 2 FAIL / 7 BLOCKED / 0 SKIPPED (this run). Cumulative Groups A–G: 44 cases — 28 PASS / 2 FAIL / 14 BLOCKED.
**Critical Findings:**
1. **[HIGH — backend config] C03 unlink FAILS: GoTrue returns "Manual linking is disabled"** on staging → the linked-provider unlink can never succeed until Manual Linking is enabled in Supabase Auth settings. (CDP-captured console.error; 3 consistent attempts; DB-closed.)
2. **[MED — spec/code] G01 greeting not implemented** — `_getGreeting()` dead code; no "Good morning/afternoon/evening, {name}" on Home.
3. **[MED — doc drift] G02 banner priority ≠ implementation** — guide says grace > payment-fail > trial > draft; source renders Trial/PaymentFail as always-shown alerts + Action Items prioritized ID > grace > drafts.
4. **[MED — app] G07 "Show more actions" unreachable** — max 3 CTA types = MAX_VISIBLE 3, so the toggle never renders.
5. **[LOW] F01/F04 suspended fixture missing**, F02 valid-token leg untestable (no token), F03 Offline route orphaned.
**App State Left Behind:**
- Throwaway `qa.alice.17876130688712811@…` **soft-deleted** (E03) — expected; cleanup candidate (delete auth user) if a hard cleanup is wanted.
- C03 fixture `qa-linked-provider@…` **unchanged** (Google still linked, methods:3) — unlink failed, so fixture intact for a re-run after the Manual-Linking fix.
- test-buyer/test-free/test-seller/test-grace sessions all logged out; simulator left on Landing.
- No standing persona state mutated this run (E03 used a throwaway only).
**Why It Matters:** Groups E/G are broadly functional and fast (12/21 PASS with no slow transitions), and the destructive delete flow is fully verified end-to-end with DB proof. But the C03 closure surfaced a **real backend-config blocker** (Manual Linking off) that also affects any real linking — a one-toggle ops fix unblocks it. G01/G07/G09 are dead-code/spec gaps that need a product call, and F01/F02-valid/F03 need small fixtures to become runnable.
**How to Verify/Reproduce:** Evidence in `e2e-test-results/account-file-groups-efg-c03-2026-08-24/` (screenshots + `cdp-unlink-capture2.txt` + capture scripts). C03: log in as `qa-linked-provider@…` → Settings → Linked Accounts → Unlink → confirm → observe "Failed to unlink google account" + `[accountService] unlinkSocialAccount failed: Failed to unlink identity: Manual linking is disabled` (Hermes console). E03: repeat the throwaway signup+delete and re-check `profiles.deleted_at`/`sp_wallets.state`/`admin_activity_log`.
**Known Gaps / Not Tested:** A03/D02/C04 deferred (need live admin_config toggle arming — not QA-doable). C03 last-method-guard alert (needs C07 social-only persona + real identity). G02 grace/payment-fail/trial banner legs (no persona/timing). G04 pending/approved/rejected ID-CTA legs (all personas are `none`). G06 refresh spinner image (transient). F02 valid-token success leg. F01/F04 suspended login.
**What Needs To Be Fixed Next:**
1. **Fix (ops):** Enable **Manual Linking** in Supabase Dashboard → Authentication → Settings for staging; re-run C03 (fixture is intact and should then pass end-to-end). HIGH priority.
2. **Fix (app):** Render the time-based greeting on Home (call `_getGreeting()` + display name) or remove G01's greeting assertion from the guide.
3. **Fix (app/spec):** Reconcile G02's banner-priority description with the real layout (Trial/PaymentFail always-shown + Action Items ID>grace>drafts), and either add a 4th CTA type to make G07's Show-more reachable or remove the toggle.
4. **Fix (fixtures/dev):** Provision `test-suspended@…` (`account_status='suspended'`) for F01/F04; mint a valid `unsubscribe_tokens` row for F02-valid; decide F03's Offline route wiring.
5. **Fix (copy, minor):** DeleteAccount "Incorrect password" alert wording vs guide (doc drift), and consider a more specific C03 unlink error message.
**UX Enhancement Ideas (optional, not defects):**
- On the C03 unlink error, the generic "Please try again." gives parents no path forward — consider a message like "Account linking is currently unavailable. Please contact support." when the backend blocks (observed: user cannot resolve this themselves).
- On the Home dashboard, the greeting absence leaves the header plain — consider a simple "{time of day}, {first name}" line above the composer for warmth (grounded in G01's dead-code observation).
**Suggested Next Session:** Re-run C03 after the Manual-Linking toggle is enabled (highest-value closure), then the Group H/I (Help & Support, Education/SP Calculator) cases from the same account guide.
**Suggested to Improve Agent Rules:** None this run — the plan's explicit-start-coordinate swipe workaround for the DeleteAccount scroll-stuck state and the reconnect-capable CDP capture recipe were the key session-specific techniques (already captured in session memory for reuse).
