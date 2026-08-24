# Decision-and-Outcome Log — Groups A+B+C+D (Account File: Settings, Edit Profile, Linked Accounts, Notification Prefs)

**Run:** `e2e-test-results/account-file-groups-abcd-2026-08-24/`
**Date:** 2026-08-24, 21:47–22:22 UTC (~35 min active)
**Agent:** QA Test Agent (execution-only)
**Guide:** `cross-checked-and-consolidated/MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md` (Groups A–D)
**Device:** iPhone 17 Pro Max Simulator (iOS 26.1, `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), Expo RN dev build + Metro, staging
**Personas:** test-buyer (`49243010-…`) for Groups A/B/C/D01–D03; fresh throwaway `qa.alice.17876099769423378@kidsmarketplace.test` (`167abdc4-…`) for D04
**Auth cycles:** 3 logins (2× test-buyer, 1× fresh via signup), 3 logouts (A02 UI confirm, 2× qa-logout deep link)
**Verdict roll-up:** 16 PASS / 0 FAIL / 7 BLOCKED / 0 SKIPPED

This log is the **action → reasoning → tool-call → outcome** trace of the executing agent, written to be fed to an AI agent for process analysis. It focuses on the decisions that shaped the run (batching, pivot points, empirical dialog verification, source/DB-verified BLOCKED calls) and the friction that consumed wall-clock — not on re-listing every assertion. Derivations are in §4 (what slows execution), §5 (proactive patterns), §6 (instrumentation/fixture work).

---

## 1. Execution trace

### 1.1 Pre-flight (read-only, no device time spent blindly)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 1 | Read operating playbook §4–§9 + repo memory (`qa-test-accounts`, `locator-conventions`, `simulator-keyboard-suppression`, `manual-testing-guide-canons`) | §4 mandates canonical sources + memory before device work; §7 persona registry must be checked before creating throwaways | `read_file` (playbook), `memory view` ×4 | Rulebook loaded: §5.1 fresh-tree-per-tap, §5.2 keyboard discipline, §5.4 empirical dialog verification, §5.7 load-time tracking, §5.23 shell discipline, §7 persona registry |
| 2 | Grep the canonical guide for `ACC-TC-[A-D]0x`, read every case body (Setup / Locator hints / Assert / Dependencies) | TC-IDs are reused across guides; must execute from the named guide | `grep_search` + `read_file` (guide §119–640) | All 23 cases understood. **Pre-flagged before any device time:** B02 guide-documented NOT-IMPLEMENTED; B08 waitlist unreachable; C03 needs a linked provider; C04 needs a real OAuth callback; B09 "already verified" path looked suspicious |
| 3 | Source-pre-read (generalized rule): `SettingsScreen`, `EditProfileScreen`, `LinkedAccountsScreen`, `NotificationPreferencesScreen`, phone-verification service, `updateUserProfile.needsWaitlist`, linked-accounts guard | Must understand flows before blind UI navigation; which BLOCKEDs are real vs. reachable differs by source | `grep_search` + `read_file` on `p2p-kids-marketplace/src/screens/profile/*`, `src/services/*` | **Key source findings:** B02 = `supabase.auth.updateUser({ email })` direct, no gate (confirmed NOT-IMPLEMENTED); B08 `needsWaitlist` unreachable from EditProfile (ZIP locked); C03 last-method guard exists in source (setup gap, not code gap); B09 reads `phone_verification_codes.verified` — column existence unconfirmed from source alone |
| 4 | DB precondition checks (read-only) | §4: verify documented state before device time — B03 needs a phone-change-able persona, D01 needs toggle state baseline, B04 needs avatar state baseline | `mcp_supabase_execute_sql` (test-buyer profile row; `phone_verification_codes` schema probe) | **Key DB finding:** `phone_verification_codes` has **no `verified` column** → B09's "already verified" detection always false, and the OTP dev-bypass fallback is always used. **B09 predicted BLOCKED before any device time.** test-buyer phone = 5551234001 (restore baseline recorded), bio = "Rr", subscription-email toggle state noted |
| 5 | Device/state checks: simulator booted, app installed, Metro up, clean Landing (no LogBox) | §5.8 clean state + tool readiness | `mobile_list_available_devices`, `mobile_list_apps`, `fetch_webpage(localhost:8081/status)` | All green; Landing clean |
| 6 | **Batching plan** (not in guide): Groups A→B→C→D01–D03 on test-buyer with 1 login; D04 (fresh-user precondition) on 1 fresh signup; use qa-logout deep link except where UI logout is the case under test (A02) | §5.26 persona-batching + minimize auth cycles (report: 3 logins/3 logouts for 23 cases) | — | 23 cases across 2 personas; every extra login avoided saved a keyboard-dance + ~5–10s |

### 1.2 Group A — Settings hub (test-buyer, login #1)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 7 | Login test-buyer → Home dashboard | clean start; load-time measured (~1.5s) | `mobile_click_*`, `mobile_list_elements_on_screen`, screenshot | Login → Home dashboard ~1.5s (<3s) ✓ |
| 8 | Profile → Settings → **A01** render check | A01 Assert = 4 sections + 11 rows | `mobile_list_elements_on_screen` per section, screenshots (`A01-settings-full.png`) | 4 sections + 11 rows render; no "Help & Support" row. **PASS.** Noted the locator-hints note about Help & Support is stale wording (Expected Result already correct) |
| 9 | **A02** Sign Out: tap → dialog appears → **empirical dialog-type verification** before handling | §5.4: don't trust the "native Alert.alert" Dependencies label; check the tree for GlobalAlertProvider vs native | `mobile_list_elements_on_screen` (dialog), screenshot | **Dialog is in-app GlobalAlertProvider** (`global-alert-button-*` in tree), NOT native `Alert.alert` — guide label is doc drift. Buttons fully instrumentable → no Option-B fallback needed |
| 10 | A02 leg 1: Cancel → session kept → Profile | Assert: cancel keeps session | tap `global-alert-button-0` (Cancel) | Session intact ✓ |
| 11 | A02 leg 2: Sign Out → confirm → Landing | Assert: confirm logs out | tap confirm, poll tree | → Landing (logout #1, via UI — this IS the case under test) |
| 12 | Re-login test-buyer (login #2) → Settings | A03–A05 need an authenticated session | baseline path | Home → Settings |
| 13 | **A03** Test Push Notification → loading spinner → result | Assert: queued/rate-limit/quiet-hours | `mobile_click_*`, poll | **"Send Failed: No push tokens registered"** — no Expo push token on sim. Rate-limit (10+/hr) and quiet-hours legs not inducible. **BLOCKED (env).** One attempt, fast fail — no wasted retries |
| 14 | **A04** TOS / Privacy / Liability → navigate + back; Privacy & Security; Linked Accounts; Notification Preferences | Assert: each row routes; back works | `mobile_click_*` + back each time; **WebView screenshots as primary evidence** (§5.5 — WebView trees explode to 200KB+) | All legal screens navigate + back correctly; Privacy & Security = no-op stub. **Critical finding:** legal docs render **third-party boilerplate** (TOS = Google Cloud Marketplace, Privacy = Walmart Seller Privacy Notice, Liability = Amazon insurance text, all "Last updated: 4/1/2026") |
| 15 | **A05** Manage Payment Methods | Assert: navigates to PaymentMethodsScreen | `mobile_click_*`, screenshot (`A05-payment-methods.png`) | PaymentMethodsScreen renders with saved Mastercard ••••4444. **PASS** |

### 1.3 Group B — Edit Profile (test-buyer) — the highest-friction group

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 16 | Profile → Edit Profile → **B01** prefill + save (bio "QA test bio 0824") | Assert: prefilled, locked fields, optimistic save | `mobile_type_keys` (bio), Cmd+K before Save tap, poll | Prefill + locked fields verified. Save → Profile with new bio immediately (optimistic) |
| 17 | **B01 persistence close:** read-only SQL on `profiles` | §5.11 DB-over-UI for persistence — optimistic UI patch can lie | `mcp_supabase_execute_sql` | bio persisted, `updated_at` matches. **PASS** (bio change recorded as state left behind for cleanup) |
| 18 | **B02** email change | Guide documents NOT-IMPLEMENTED + source confirmed direct `updateUser` | — | **BLOCKED (feature not implemented).** **Deliberately did NOT mutate the email** to protect the persona — the report notes "no email mutation performed to protect persona" |
| 19 | **B03** phone change → OTP modal | Assert: OTP modal + resend countdown + verify | `mobile_type_keys` (5559998888), Save | OTP modal (fullScreen) appears with resend + countdown |
| 20 | **OTP modal is NOT AX-exposed** → empirical check + pixel-scan technique | §5.4 native `ui/Modal` pattern: buttons never surface in AX tree regardless of checking | `mobile_list_elements_on_screen` (only clock), **pixel-scan for button band**, tap band center | Verify/Cancel/Change-Phone buttons confirmed not in tree → **locator gap finding**. Pixel-scan used to tap Verify |
| 21 | **Verify first-tap swallow:** first tap on Verify no-ops; second tap lands | Known interaction quirk on this build's modal | `mobile_click_*` ×2 | Code 123456 → verified → Profile redirect (~1.5s) |
| 22 | **B03 DB investigation (the money find):** compare `auth.users.phone` vs `profiles.phone` + `phone_verified_at` | Assert says "marks the phone verified" — need the DB truth, not just UI | `mcp_supabase_execute_sql` (auth vs profile) | **Persistence gap:** auth.phone = 5559998888 (changed) but profiles.phone = 5551234001 and phone_verified_at = NULL. Phone-gate still treats user as unverified; profile display inconsistent. **MOD-HIGH finding** |
| 23 | **Profile stuck-loader:** after `navigation.reset` from phone verify, Profile shows "Loading profile…" indefinitely | Not a transition timeout — real hang | poll tree ~15s, navigate away + back | Recovers only after leaving/re-entering Profile. **MOD finding** (B03) |
| 24 | **B04** avatar upload → native photo picker | Assert: uploading state + new avatar renders | `mobile_click_*` (`edit-profile-avatar-button`) | **Surprise:** native picker + crop/confirm window IS AX-drivable **this build** — photos exposed in grid, "Choose" tappable. **Direct reversal of the prior day's §5.31 "crop editor undrivable" conclusion (Group H)** |
| 25 | B04 pick photo → Choose → verify avatar | §5.1 re-derive; poll for upload completion | `mobile_click_*`, screenshots (`B04-avatar-picker.png`, `B04-after-choose.png`, `B04-profile-new-avatar.png`), DB check | Avatar renders; storage object + `avatar_url` DB-proven. **PASS** (deferred uploading-state spinner sub-assertion documented as not exercised — success leg verified) |
| 26 | **B05** Profile stats/badges/reviews/status/ID/referral | Assert: full Profile display sections | `mobile_list_elements_on_screen`, screenshot (`B05-profile.png`) | All render. **Noted nuance:** subscription badge shows "Kid's Club Member / Exclusive perks active" while DB is in grace period (grace_ends_at 2026-09-12) — status-label vs guide taxonomy |
| 27 | **B06** inline validation (email `abc`, phone <10 digits, then valid values) | Assert: inline errors + valid clears | `mobile_type_keys` ×3, per-field tree re-list (§5.2), Cmd+K | Invalid → exact inline errors; valid values clear + save proceeds. **PASS** |
| 28 | **B07** save with no changes → "No Changes" alert → OK | Assert: alert text + OK returns to Profile | `mobile_click_*`, **empirical dialog check** | **GlobalAlertProvider again** (doc drift from "native Alert.alert"). "No changes were made to your profile." → OK → Profile. **PASS** |
| 29 | **B08** ZIP locked + helper | Assert: "ZIP CODE (CANNOT BE CHANGED)" + helper | screenshot | ZIP locked with correct helper. Waitlist path unreachable (source-verified `needsWaitlist`). **PASS** |
| 30 | **B09** "already verified" phone path | Pre-flagged BLOCKED in §1.1 (#4) — `verified` column missing → `alreadyVerified` always false | — | Confirmed: entering current phone → Save → "No Changes" (B07), never the Info alert. **BLOCKED (schema drift)** — reported as HIGH because it also breaks OTP bookkeeping + forces dev-bypass |
| 31 | **B10** both Question icons → Contact Support alerts; inputs disabled; ZIP no icon | Assert: alert title + support email; disabled inputs | `mobile_click_*` (Question icons), **empirical dialog check** | Both → in-app "Contact Support / …admin-support@kidsmarketplace.app."; inputs disabled; ZIP has no icon. **PASS** |

### 1.4 Group C — Linked Accounts (test-buyer)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 32 | Settings → Linked Accounts → **C01** layout | Assert: email readonly, info card, password row, 3× "Not linked" + Link buttons | `mobile_list_elements_on_screen`, screenshot (`C01-linked-accounts.png`) | Email readonly + info card + "Password ✓ set" + 3× "Not linked" + Link buttons. **PASS** |
| 33 | **C02** Link (Google) → password re-auth modal | Assert: password re-auth gate appears before OAuth | `mobile_click_*`, **empirical dialog check** | Re-auth modal is **in-app, not native** — Cancel/Confirm NOT AX-exposed (pixel-scan required, **locator gap**). Confirm → simulated OAuth Flow alert. **PASS** |
| 34 | **C03** unlink leg | Requires a linked provider on persona — **none exists** (all "Not linked") | — | **BLOCKED (setup gap).** Last-method guard source-verified in code; not reachable without a linked provider. No attempt made to force-link (would pollute persona + C04 fixture) |
| 35 | **C04** email-mismatch on link | `EmailMismatchError` requires a **real OAuth callback**; dev Link flow is simulated (alert) | — | **BLOCKED (not inducible in dev).** Documented; no fixture mutation of the Facebook identity was performed (report notes this explicitly) |

### 1.5 Group D — Notification Preferences (test-buyer + fresh persona)

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 36 | Settings → Notification Preferences → **D01** render + persist | Assert: 5 categories × 3 toggles, persist across reload | `mobile_list_elements_on_screen` — **Switch/input coordinates extracted from the full AX-tree resource file via grep** (inline tree output truncated ~2k chars; resource file ~17KB+ held the full tree) | 5 categories × 3 toggles render |
| 37 | D01 toggle a Push/In-App/Email switch; verify persist | Assert: persists across reload | `mobile_click_*` (from resource-file coordinates), terminate+relaunch, **DB close** | Toggle persisted (DB + reload verified). **PASS.** ⚠️ subscription-email toggle left ON — recorded as state left behind |
| 38 | **D02** optimistic revert on failure | Assert: failed save reverts toggle | — | **BLOCKED — no failure-forcing mechanism** in dev (no hook; real failure would need network manipulation). No artificial offline test possible within execution-only scope |
| 39 | **D03** quiet hours valid + invalid | Assert: valid 24h save + "Invalid time format…" for "9pm" | `mobile_type_keys` (22:00/08:00; then 9pm), screenshots (`D03-quiet-hours-invalid.png`) | Valid → "Quiet hours have been updated."; invalid → exact error. **PASS** |
| 40 | **D04** fresh-user empty state | Assert: "No preferences found" + [Initialize Settings] for a user with no rows | — | **Pre-flagged from DB:** signup auto-creates all 5 pref rows → empty state unreachable |
| 41 | D04 fresh signup (`qa.alice…`) → Notification Preferences | §7: throwaway persona for the fresh-user precondition | full signup baseline (dev autofill + one-tap OTP verify), screenshots (`D04-fresh-user-no-empty-state.png`) | Full populated view, **no empty state** — guide expectation obsolete. **BLOCKED (spec drift, dead code)** — signup auto-creates prefs + `getNotificationPreferences` self-heals via `initialize_user_preferences` |
| 42 | Cleanup: qa-logout deep link ×2 (test-buyer + throwaway) → Landing; leave sim logged out | clean end state; §7 registry hygiene for the throwaway | `run_in_terminal` (`xcrun simctl openurl booted "p2pkidsmarketplace://qa-logout"`) | Simulator logged out on Landing |

### 1.6 Post-run

| # | Action | Reasoning | Tool calls | Outcome |
|---|---|---|---|---|
| 43 | Write report + archive 33 evidence screenshots | §8 report + handoff; reproducibility | `create_file` (`report.md`), screenshots in run folder | Report + evidence archived |
| 44 | Update repo memory: **amend the §5.31 known-undrivable note** for the native picker to "build-dependent, verify per run" (this run it WAS drivable); record the **AX-tree resource-file grep technique** (full tree 17KB+ vs ~2k inline truncation) | "Suggested to Improve Agent Rules" — durable process lessons from this run | `memory` update (`/memories/repo/`) | Memory updated: (1) crop/confirm window drivability is build-dependent; (2) extract full-tree coordinates with `grep -o '"name":"…"[^]]*'` on the AX resource file |
| 45 | Document App State Left Behind (bio, avatar, subscription toggle) with restore instructions | seed restores; next session must not inherit dirty persona state | — | Cleanup checklist in report |

---

## 2. Bottlenecks & challenges (ranked by wall-clock cost)

1. **Modal-button AX gaps + first-tap swallow (Edit Profile / Linked Accounts, ~4–5 min cumulative).** The fullScreen OTP modal (Verify/Cancel/Change-Phone) and PasswordReauthModal (Cancel/Confirm) never surface in the AX tree → every interaction is a pixel-scan round-trip. Worse, the OTP **Verify button swallows the first tap** (2-tap needed each time) — each swallow costs a full tap + re-list cycle. This is the single most repeated friction of the run.
2. **AX-tree inline output truncation (~2k chars vs 17KB+ resource file).** For any non-testID coordinate (Switch toggles, inputs) the inline tree was truncated → the agent had to extract coordinates from the full AX-tree resource file with a grep (`grep -o '"name":"…"[^]]*'`). Discovered this run; saved the rest of the run but added an extra step per extraction on first use.
3. **Multi-query DB verification for the phone-persistence cluster (B03).** Closing the "phone marked verified?" assertion truthfully required cross-checking `auth.users.phone` vs `profiles.phone` vs `phone_verified_at` vs `phone_verification_codes` schema — 3–4 SQL round-trips to surface one MOD-HIGH finding. High value (real defect), but a genuine time cost.
4. **WebView evidence capture for 3 legal docs (A04).** Per §5.5, WebView trees are unusable → each legal doc needed a screenshot + OCR/content review, which is exactly what surfaced the third-party-boilerplate finding. ~2–3 min for the A04 group.
5. **Profile stuck-loader recovery (B03).** The phone-verify `navigation.reset` left Profile hanging on "Loading profile…" — cost a ~15s poll + a navigate-away/back recovery cycle before B05 could proceed.
6. **A fresh signup for D04 (~2 min including persona cleanup).** Needed for the fresh-user precondition; the signup path is well-oiled (dev autofill + one-tap OTP) but still the run's only paid-for persona cycle.
7. **Auth-cycle overhead (3 logins / 3 logouts).** Mitigated by batching (23 cases over 2 personas), but each cycle still costs a keyboard-dance + ~5–10s. A02's UI logout was unavoidable (it was the case under test).
8. **DB schema drift discovery mid-run (B09).** The `verified`-column absence was caught in pre-flight DB probing (§1.1 #4), so B09's device-time cost was minimal — but the probe itself was an extra step that was only done because B09's Assert looked suspicious from source.

## 3. Reasoning patterns observed (what the agent did right / should keep doing)

1. **Pre-flight source+DB BLOCKED prediction.** B02 (NOT-IMPLEMENTED), B08 (locked ZIP), B09 (`verified` column missing), C03 (no linked provider), C04 (simulated OAuth) were all flagged as BLOCKED/unreachable **before device time** from source reads + read-only SQL. Device time was spent only confirming cheaply. This is the single highest-leverage pattern (matches Phase 23's documented finding).
2. **Empirical dialog-type verification on first encounter (not trusting labels).** A02/B07/B10/C02 all confirmed **in-app GlobalAlertProvider** where the guide's `Dependencies:` claimed "native Alert.alert" — recorded as doc drift, and the instrumentable `global-alert-button-*` path used instead of Option-B fallback. The two **native** `ui/Modal`-class dialogs (OTP, re-auth) were correctly pixel-scanned.
3. **DB-over-UI persistence closing on every optimistic-save case.** B01 (bio + updated_at), B04 (avatar_url + storage object), D01 (toggle rows), D03 (quiet-hours), and crucially B03 (the negative result — auth vs profile phone divergence) were all closed with read-only SQL rather than trusting the UI.
4. **Persona-protective judgment.** B02 deliberately did **not** mutate the email; C03/C04 deliberately did **not** force-link a provider or mutate the Facebook identity — preserving the persona and fixtures, and documenting why the leg was skipped rather than "performing" a destructive action.
5. **Reversal-aware evidence.** The native crop/confirm window being AX-drivable was a **direct reversal** of the prior day's Group H conclusion — verified empirically, then the durable note was amended to "build-dependent, verify per run" rather than re-asserting either stale claim.
6. **Fast-fail on environment blockers.** A03 → "No push tokens" → BLOCKED after one attempt; no retry churn on an env limitation.
7. **Instrumentation discovery + capture.** The AX-tree resource-file grep technique was found mid-run, applied to the remaining Switch/input extractions, and recorded as an agent-rule improvement.
8. **State-leak hygiene.** Every persona mutation (bio, avatar, subscription toggle) was tracked as "App State Left Behind" with explicit restore/seed instructions — not silently rolled forward.

## 4. (a) What slows execution

- **Modal buttons that never reach the AX tree** (OTP Verify/Cancel/Change-Phone, re-auth Cancel/Confirm): every interaction becomes a pixel-scan round-trip, and the OTP Verify **first-tap swallow** doubles each attempt. **Biggest multiplier.**
- **AX-tree inline truncation**: extracting non-testID coordinates requires the extra full-resource-file grep step whenever the target lacks a `testID`.
- **Multi-query DB forensics** for any persistence/consistency assertion (auth vs profile vs codes) — high value, but 3–4 SQL calls per defect cluster.
- **WebView content evidence** (screenshot + OCR per legal doc) whenever a WebView page's *content* matters, not just its navigation.
- **Stuck-loader recovery** (Profile after phone-verify reset): a poll + navigate-away/back cycle.
- **Auth cycles** (login/logout) and **fresh-persona signup** as per-case setup — mitigated by batching but never free.
- **Guessing at DB schema** (`phone_verification_codes` columns) instead of having the schema pre-read — one probe run caught it, but a standing schema snapshot would have removed the guess.

## 5. (b) What patterns an agent should adopt proactively

1. **Run the source+DB BLOCKED-prediction pass FIRST** (Phase 23 pattern, confirmed again): read the screen/service source + run read-only schema probes for every case whose Assert smells unreachable. It converted 5 of the 7 BLOCKEDs into cheap pre-confirmations instead of attempted flows.
2. **Treat dialog type as an empirical fact per run, never per guide.** On the first dialog of each kind, check the tree for GlobalAlertProvider identifiers before any Option-B fallback; record the mismatch as doc drift. Don't carry a "native vs in-app" conclusion across builds.
3. **Never trust an optimistic UI patch alone — DB-close every persistence claim, including the negative case.** The B03 defect was only visible by cross-checking auth vs profile rows; a UI-only run would have "passed" the verify flow.
4. **Check AX-drivability of native windows per run, not from memory.** The crop/confirm editor flipped from undrivable (2026-08-23) to drivable (2026-08-24). Always attempt the first native interaction once; only fall back to pixel-scan/terminate-escape after an empirical miss.
5. **When inline AX output truncates, extract from the full resource file** with a targeted grep — cheap, reliable, and reusable for every non-testID coordinate in the session.
6. **Protect persona + fixtures**: skip destructive legs (email mutation, provider linking) and report them as skipped-for-persona-preservation with the setup gap, rather than polluting shared state.
7. **Batch aggressively, pay for only one fresh persona** when a case needs a distinct precondition (D04), and reuse the well-oiled signup baseline (dev autofill + one-tap OTP) when you must.
8. **Track every state leak and hand it to the next session** — bio/avatar/toggle changes are persona-state debt that must be called out with a restore path.
9. **Fast-fail on environment blockers** (push tokens, network-manipulation needs): one attempt, then BLOCKED with the concrete unblock action.

## 6. (c) What instrumentation / fixture work removes the friction

1. **Expose OTP-modal + re-auth-modal buttons to AX** (`accessible`/`accessibilityRole`/`accessibilityLabel` on Verify/Cancel/Change-Phone and PasswordReauth Cancel/Confirm) — removes the pixel-scan round-trips **and** the locator gaps. Highest-value instrumentation item for this module.
2. **Investigate + fix the OTP Verify first-tap swallow** — a real interaction defect that also inflates test time (every verify = 2 taps).
3. **Add `phone_verification_codes.verified` column (or fix app queries)** so the B09 already-verified path works and OTP bookkeeping stops falling to the dev-bypass. This is a backend schema fix, not a test fix.
4. **Make phone-verify success sync `profiles.phone` + `phone_verified_at`** (in `auth-update-phone` edge function or app fallback) — closes the B03 MOD-HIGH persistence gap and makes the phone-gate truthful.
5. **Fix the Profile "Loading profile…" hang** after phone-verify `navigation.reset` — investigate the focus/fetch race.
6. **A03 needs a push token on the simulator or a dev injection** to exercise the queued/rate-limit/quiet-hours legs (currently env-blocked).
7. **D02 needs a failure-forcing dev hook** (e.g. a `qa_force_pref_save_failure` admin toggle, mirroring `qa_avatar_upload_failure`) to test the optimistic-revert path.
8. **C03/C04 fixtures**: a persona with a linked provider (for unlink + last-method guard) and a real-OAuth-callback fixture for `EmailMismatchError` (dev Link flow is simulated).
9. **D04 spec decision**: remove the dead empty-state/Initialize-Settings path (signup auto-creates prefs + self-healing init) or update the guide — a doc decision, not code.
10. **Replace the imported legal boilerplate** (Google/Walmart/Amazon docs) with the app's own drafted TOS/Privacy/Liability — content-owner task, HIGH severity for a kids' marketplace (A04 + J-series).
11. **Standardize Linked Accounts action buttons on canonical `#5DBB8E`** (or document the `#4A7C59` exception) — minor token deviation on that surface.
12. **Cheap process wins:** add a standing `phone_verification_codes` schema note to repo memory (column drift is the root of B09); keep the AX-resource-file grep technique documented as the standing coordinate-extraction path.

---

## 7. Summary of what the run proved

- The Account module's **Settings / Edit Profile / Linked Accounts / Notification Preferences** surfaces are broadly functional and fast: **16 PASS / 0 FAIL / 7 BLOCKED**, no transition ≥3s (fastest ~0.5s, slowest ~2s).
- One **HIGH severity content defect** (imported legal boilerplate on a kids' marketplace) and one **HIGH schema-drift defect** (`phone_verification_codes.verified` missing) surfaced — plus a **MOD-HIGH phone-persistence gap** (auth vs profile divergence after verification) and a **MOD stuck-loader** after phone-verify reset.
- 5 of the 7 BLOCKEDs were predictable from source+DB **before** device time (B02, B08, B09, C03, C04) — the pre-flight prediction pass is the highest-leverage time-saver, re-confirmed this run.
- Dialog-type doc drift is pervasive in this module's guide (all four "native Alert.alert" labels were actually in-app GlobalAlertProvider), making **empirical per-run verification** mandatory.
- The native picker's crop/confirm window flipped to **AX-drivable** on this build — a concrete, evidence-backed reversal of the prior day's §5.31 conclusion, and a warning against carrying "undrivable" assumptions across builds.
