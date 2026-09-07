# QA Task 43 v3 — AUTH + ACC Closure Round (Adjusted for 2 Owner-Pending Items)

- **Date:** 2026-09-07
- **Run folder:** `e2e-test-results/qa-task43-v3-auth-acc-closure-2026-09-07/`
- **HEAD:** `fe5294a3` (Dev Task 128 v2)
- **Device:** iPhone 17 Pro Max simulator (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
- **Exact mined call count:** **357 tool executions / 330 messages** (`qa:mine-call-ledger` on session transcript `bfa6ac72-…`)
- **Scope:** 7 batch items executed (5 mechanism-ready + 2 newly unblocked) + 1 partial spot-check + bookkeeping. AUTH-S01 excluded (owner-pending SendGrid SMTP). AUTH-C07 partial only (owner-pending Google identity).

## Verdict roll-up

| Batch | Case | Verdict | Top finding |
|---|---|---|---|
| 1 | ACC-J07 (no published TOS/Privacy) | ✅ PASS | `policy_failure=no_policy` → Settings→TOS/Privacy show "not available" alert + auto-back; no crash, navigable |
| 1 | ACC-J12 (Disclaimer no-policy) | ✅ PASS | `no_policy` → Liability Disclaimer inline "No published liability disclaimer available." + Retry; back works |
| 1 | ACC-J08 (legal load failure) | ✅ PASS | `fetch_failure` → TOS/Privacy alert + inline not-available (no Retry); Liability inline error + Retry → disarm → Retry recovers content |
| 1 | ACC-J02 (TOS acceptance requireAcceptance) | ✅ PASS | test-payfail UI login (unaccepted) → gate → TOS requireAcceptance; Decline → 0 rows; relaunch re-prompt → Accept → v1.1 row |
| 1 | ACC-J05 (policy versioning re-prompt) | ✅ PASS | Admin published QA TOS v1.2 + Privacy v1.1 → test-buyer re-prompted (screens show new versions) → accepted → original versions restored |
| 1 | ACC-G02 (dashboard banners) | ✅ PASS | test-payfail PaymentFailureBanner, test-trial "5 Days Left in Your Trial", test-grace grace+ID+draft Action Items (Continue/Maybe later) |
| 2 | AUTH-P03 (chat unread badge) | ✅ PASS | seed self-refresh fixture → unread seller msg → header chat badge "1" → open chat → read_at set → badge cleared |
| 2 | ACC-H03 (FAQ offline fallback) | ✅ PASS | `faq_failure=fetch_failure` → 5-category fallback + 10 fallback FAQs; disarm → real DB FAQs returned |
| 3 | AUTH-C07 (Set Password modal) | 🟡 PARTIAL | RPC `can_set_password` live true + LinkedAccounts/SetPasswordModal wiring verified; modal on-device drive gated on Google identity attach |

**7 PASS / 1 PARTIAL / 0 FAIL / 0 BLOCKED-as-defect.**

## Excluded / unchanged dispositions (per brief)
- AUTH-S01 — excluded this round; still BLOCKED on owner's SendGrid Supabase-Auth-SMTP dashboard step (documented in `docs/ENVIRONMENT-VARIABLES.md`).
- AUTH-C03 (Apple) — deferred (no developer account).
- ACC-B03 real-SMS leg — deferred to F&F testing.
- ACC-G09 — won't-test.
- ADM 3 permanent, TRD 19 deferred, ACC 4 MFA (now NOT-IMPLEMENTED bucket — see bookkeeping).

## Bookkeeping
- ACC-K01–K04 moved from 🔴 OPEN → 🚫 NOT-SUPPORTED (NOT-IMPLEMENTED bucket): MFA deliberately unimplemented (guide-currency audit 2026-09-02: no MFA UI/route/code; Settings Privacy & Security row is a TODO stub).
- AUTH-Q04 guide doc **confirmed showing $1.49** (subscriber flat fee; 149¢ override) — `cross-checked-and-consolidated/AUTH-…/` Q04 body line: "live subscriber override is **$1.49** (149¢)… non-subscriber **$20.00** (2000¢)."
- Tracker note AUTH-S01: still BLOCKED, pending the SendGrid dashboard step — not re-attempted this round.
- Tracker note AUTH-C07: PARTIAL, pending the Google identity-attach step (owner).

## Per-case execution detail

### ACC-J07 — Legal screen unavailable (no published policy) — PASS
Mechanism: session-local `policy_failure=no_policy` (armed via `qa-dev-toggle` deep link; fail-closed in release). test-buyer → Settings → Legal rows.
- TOS leg: Settings → Terms of Service with `no_policy` → in-app GlobalAlert "Error / Terms of Service not available" + auto `goBack` to Settings. Evidence: `ACC-J07-TOS-no-policy-alert.png`.
- Privacy leg: → "Privacy Policy not available" + back. Evidence: `ACC-J07-Privacy-no-policy-alert.png`.
- UX note: build behavior = **Alert + auto-goBack** (matches source `TermsOfServiceScreen.tsx`/`PrivacyPolicyScreen.tsx` + unit tests `flow25-legal-settings.test.tsx` J07). The guide's "inline '…not available'" phrasing is a doc-vs-build nuance, not a defect — graceful, no crash, back works.
- Design-system: dialog uses in-app `GlobalAlertProvider` (title #1A1A1A, single OK pill) — on-brand; no deviation.

### ACC-J12 — Liability Disclaimer unavailable — PASS
`policy_failure=no_policy` → Settings → Liability Disclaimer → inline error state "No published liability disclaimer available." with WarningCircle (#F59E0B) + Retry; screen stays (no auto-back); back works. Evidence: `ACC-J12-liability-no-policy.png`.

### ACC-J08 — Legal load failure (Retry only on Liability) — PASS
`policy_failure=fetch_failure`:
- TOS: Alert "Failed to load Terms of Service"; after dismiss, screen stays with inline "Terms of Service not available" (no Retry). Evidence: `ACC-J08-TOS-fetch-failure-alert.png`, `ACC-J08-TOS-inline-not-available.png`.
- Privacy: Alert "Failed to load Privacy Policy" + inline "Privacy Policy not available" (no Retry). Evidence: `ACC-J08-Privacy-fetch-failure-alert.png`, `ACC-J08-Privacy-inline-not-available.png`.
- Liability: inline "Failed to load disclaimer. Please try again." + Retry; disarm (`none`) → tap Retry → **real disclaimer content loaded** (title "Kids P2P Liability Disclaimer 3", Last updated 4/2/2026). Evidence: `ACC-J08-Liability-fetch-failure-retry.png`, `ACC-J08-Liability-retry-recovered.png`.

### ACC-J02 — TOS acceptance flow (requireAcceptance) — PASS
Persona: **test-payfail** (email/password, no policy-acceptance rows — verified DB pre-run; NOT `qa-login-as`, which auto-accepts). Login via email/password UI → PolicyReacceptanceGate fired → Terms of Service `requireAcceptance` screen (accept-tos-button + decline-tos-button).
- **Decline leg:** tapped [Decline] → user continued to Home (soft gate); DB read-back: 0 `policy_acceptances` rows for test-payfail. ✓
- **Fresh launch leg:** terminated + relaunched → gate re-prompted (process-lifetime guard reset) → TOS requireAcceptance again.
- **Accept leg:** tapped [I Accept] → recorded `terms_of_service` v1.1 (accepted_at 13:34:36 UTC) → proceed to Home.
- Evidence: `ACC-J02-TOS-requireAcceptance-screen.png`. DB-verified both legs.

### ACC-J05 — Policy versioning — re-acceptance on new version — PASS
Real admin publish on `:3001` (`/settings/policies`), full round-trip with restore:
1. Created QA drafts TOS v1.2 (`88abfb6a`) + Privacy v1.1 (`49b8398b`) via the real admin UI (new-version forms).
2. Published both via the list-page Publish buttons (DB-verified: TOS v1.2 + Privacy v1.1 `published`, old v1.1/v1.0 `archived`).
3. **test-buyer** (accepted old v1.1/v1.0) UI email/password login → re-prompted → TOS requireAcceptance showing **"Version 1.2"** + new content → accepted (14:01:56). Evidence: `ACC-J05-test-buyer-reprompt-TOS-v1.2.png`.
4. Fresh launch → Privacy requireAcceptance showing **"Version 1.1"** → accepted (14:03:00). Evidence: `ACC-J05-test-buyer-reprompt-Privacy-v1.1.png`.
5. **"Only latest published version shown / drafts never visible to end users"** — screens rendered the newly published versions; archived old versions not surfaced as options.
6. **Cleanup:** restored original TOS v1.1 + Privacy v1.0 as active (archived the QA versions) via the admin "Make Active" (republish). test-buyer's prior v1.1/v1.0 acceptances (13:34) remain valid against the restored active versions → **no residual re-prompt for any persona**. QA J05 v1.2/v1.1 remain as archived rows (test-buyer acceptance rows prevent deletion — harmless, like existing stale "Test" drafts).
- Note: publishing any new policy version on shared staging is inherently a blast-radius action; restore returned the environment to its pre-run state. R55 mobile leg driven same-session.

### ACC-G02 — Dashboard banners — PASS
- **test-payfail** (retry 1/active): independent **PaymentFailureBanner** — "Payment Failed / Retry 1 of 3 • Next retry in 3 days / Your payment was declined…". Evidence: `ACC-G02-test-payfail-payment-failure-banner.png`.
- **test-trial** (5d, trial_end 2026-09-12, DB-verified): independent **TrialReminderBanner** "5 Days Left in Your Trial" (no payment-fail, no stacking). Evidence: `ACC-G02-test-trial-trial-banner.png`.
- **test-grace** (grace_ends 2026-11-05, DB-verified; 2 drafts DB-verified): Action Items → Card 1 **ID-verification CTA** ("Verify Your Identity / Verify Now / Maybe later"), Card 2 **GracePeriodBanner** ("Grace Period Active / You have 60 days to re-subscribe before your Swap Points are deleted."), hidden 3rd = **ResumeDraftBanner** revealed via "Show 1 more action" → "You have 1 unfinished listing / Continue where you left off" with visible **Continue / Maybe later** buttons (source-confirmed `ResumeDraftBanner.tsx` + on-device; NOT "Continue listing"/"Dismiss") + "Show less". Evidence: `ACC-G02-test-grace-grace-actionitems.png`, `ACC-G02-test-grace-expanded-draft-cta.png`.
- Banner independence confirmed: trial/payment-fail banners present only in their own states and never stacked; grace/draft/ID render inside the collapsible Action Items (MAX_VISIBLE=2 + show-all/show-less — G07 mechanism exercised).
- Friction note: Home ScrollView AX coordinates were logical-vs-rendered after flingy scrolls (per §5.9) — show-all required careful re-derivation (documented under friction).

### AUTH-P03 — Header chat unread badge — PASS
- Ran `seed:staging` (owner-sanctioned in the brief) → `seedUnreadMessageFixture` self-refresh created unread seller→buyer message `a85aabb3` on pending trade `d8e14d86` (read_at NULL; DB-verified). Total unread for test-buyer = 1.
- Relaunch as test-buyer → header chat icon showed **"1"** badge (visual; bell carries a separate unrelated "99+" notifications badge). Evidence: `AUTH-P03-home-header-chat-badge.png`.
- Tapped chat → Messages list with the unread conversation at top (badge "1", seller msg "1m ago"). Evidence: `AUTH-P03-messages-unread-conversation.png`.
- Opened the conversation (first-time safety modal → confirm) → message visible → DB read_at set (14:06:30). Evidence: `AUTH-P03-chat-opened-seller-message.png`.
- Returned Home → **chat badge cleared** (0 unread DB). Evidence: `AUTH-P03-home-header-badge-after-read.png`.
- The fixture is now reliably re-runnable (seed self-refreshes `read_at=NULL`; targets pending/in-progress seller-owned trades so it no longer collides with B08/DT-96).

### ACC-H03 — FAQ offline fallback — PASS
- Armed `faq_failure=fetch_failure` → Help & Support → FAQ list rendered the **5-category fallback** chips (All / Getting Started / Swap Points / Trading / Account / Safety) + all **10 hardcoded fallback FAQs** instead of an error. Evidence: `ACC-H03-FAQ-fallback-categories.png`, `ACC-H03-FAQ-fallback-list.png`.
- Disarmed (`none`) → back + re-enter FAQ → **real DB FAQ set returned** (list now includes DB-only rows, e.g. "…listing 222" + "what Samer test 1 does" — not in the fallback). Evidence: `ACC-H03-FAQ-disarmed-db-faqs.png`.
- Disarm verified (R28).

### AUTH-C07 — Set Password (social-only) — PARTIAL
- `SELECT public.can_set_password('a1234567-…-000d')` → **true** (live; the brief's exact query).
- `check_account_exists_by_email('qa-social-only@…')` → `{exists:true, user_id:…000d, providers:["email"], has_password:false}` — password-less precondition holds.
- LinkedAccountsScreen + SetPasswordModal wiring **source-verified** (DT-128 landed): `set-password-button` opens `SetPasswordModal` when `!hasPassword`; `onSuccess` reloads → row flips "No password set" → "Password ✓ set". Modal requires a strong password + calls `setPasswordForSocialUser`.
- LinkedAccounts renders on-device (test-buyer, password-present branch → "Password ✓ set", no set-password button). Evidence: `AUTH-C07-linked-accounts-password-set-branch.png`.
- **Not drivable this round:** the `!hasPassword` branch (Set Password button + modal drive) requires an authenticated session as qa-social-only, which cannot be established without a Google identity (owner step 2, pending — no real Google identity attached; email-OTP magic-link would need the SendGrid SMTP still pending; no dev email-OTP bypass exists in `auth.ts`). Setting a password now would also consume the fixture and block the owner's Google-attach step.
- **Recorded note (verbatim per brief):** "modal + RPC verified; full closure pending Google identity attach." Full closure = the follow-up 2-case round (S01 full run + C07 login leg).

## UX notes (three layers)

### Structural / affordance
- No structural defects in the batch. All legal screens recover cleanly (alert or inline error + navigable back). The dashboard banners render in the documented positions with no occlusion of primary content.
- Perceived load times all < 3s (no ≥3s transition observed in this batch — see load-time table below).

### Wording / copy clarity
- All copy on the surfaces visited is parent-friendly and unambiguous. No raw error codes / machine strings observed on any user-facing surface (R58 audit: J07/J08 legal alerts, J12 disclaimer, G02 banners, FAQ fallback, P03 chat — all clean).
- Minor doc-vs-build note (not a defect): J07/J08 guide text describes an "inline '…not available'" state, while the current build surfaces the not-available state as an in-app Alert followed by an auto-return to Settings (TOS/Privacy). The functional guarantee (clear message, no crash, navigable) is met on both readings. Flagged so the guide can be aligned if desired.

### Design-system compliance
- Every screen/dialog visited was checked against `docx/design-system-passitup.md` (§6.4 incl. popups/modals). In-app `GlobalAlertProvider` dialogs (J07/J08/J12) used the canonical single-OK layout on-brand.
- R62b standing off-brand-hex grep was not re-run as a full source sweep this round (no new screens introduced; the surfaces driven here — legal screens, dashboard, FAQ — were previously audited on-brand). Banner semantic colors observed on-brand: PaymentFailureBanner/grace card (#E85D75-family error/red accents per subscription status), trial banner warning (#FFF3E0/#FFA726 per QA Task 40 verified facts), ID CTA info tint, SP strip gold. No deviation found on any visited surface this round.
- R62c full-frame presence scan not required — no legacy-hex candidate screens were rendered in this batch.

## Perceived load-time table (per §5.7)

Label: Perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.

| Screen → transition | Elapsed | Flag |
|---|---|---|
| Login submit → TOS requireAcceptance (gate) | ~1–2s | — |
| TOS [I Accept] → Home | ~1s | — |
| Relaunch → TOS/Privacy re-prompt (bundle) | ~3s (dev-bundle reload) | env artifact (Metro dev reload), not app |
| Chat open (P03) → conversation | ~1s | — |
| Admin /settings/policies publish → DB active | ~2s | — |

## Locator-gap findings
- **Home dashboard header badge + conversation unread badges are NOT AX-exposed** (P03 badge verified visually/DB). Recommend instrumentation (BP-53) so future badge assertions are tree-readable.
- **FAQ list rows / category chips horizontal overflow** — "Account"/"Safety" chips extend past the visible band (tree reports x404–564 for a 440pt screen); scrollable chip row verified visually. Not a defect (horizontal scroll intended).

## Friction vs operating rules
- Home ScrollView AX-tree coordinates became logical-vs-rendered after flingy scrolls (§5.9 class): the `action-items-show-all` tree y (833→211 after swipe) did not match its rendered position, costing several re-derivations; resolved by scrolling to a stable position + view_image confirmation before tapping. No code/app defect.
- G02 test-grace show-all is at the tab-bar band edge — R31 applied (scrolled content so the footer cleared the floating pill before tapping).
- Admin policy publish/restore scripts hit the run_playwright_code deferred-result 2-call pattern (R-16-6) plus native `confirm()`/`alert()` dialogs; resolved with `window.confirm` override + dialog auto-accept (ADM-R6). Two publish attempts were swallowed by dialog races — re-driven cleanly; DB-verified each outcome.

## App State Left Behind
- Personas logged in/out: last session is **test-buyer** (logged in, at Home after P03/H03/C07 checks). All policy acceptances reconciled.
- `policy_failure`, `faq_failure`, `push_simulation`-class session-local toggles: **all disarmed** (`none`) — verified.
- **Policy state:** original published versions restored (TOS v1.1, Privacy v1.0). Two QA J05 versions remain **archived** (TOS v1.2 `88abfb6a`, Privacy v1.1 `49b8398b`) — they carry test-buyer acceptance rows so they cannot be hard-deleted (FK guard); harmless, but a dev/ops cleanup could remove if desired (requires clearing the acceptance rows first).
- **test-buyer** acceptance rows now include the QA versions (archived) + original versions (valid vs current). No residual re-prompt for any persona.
- P03 fixture consumed (message read); a re-run of `seed:staging` will re-create it (self-refresh).
- test-trial/test-payfail/test-grace fixtures untouched (still provisioned, per DB).
- qa-social-only: untouched (still password-less; the C07 partial did NOT consume it — full closure remains possible after the owner's Google-attach step).

## Known Gaps / Not Tested
- AUTH-S01 (Forgot Password success) — excluded per brief; still BLOCKED on owner's SendGrid Supabase-Auth-SMTP dashboard step.
- AUTH-C07 on-device modal drive (Set Password button + modal + row flip) — gated on the Google identity attach (owner step). RPC + wiring verified only.
- ACC-J05 residual: the two QA policy versions remain archived (not deletable due to acceptance rows) — documented above.
- Home header badge AX-exposure — not instrumented (visual/DB evidence used).

## Next action (explicit)
Once the owner completes the two pending steps (1: SendGrid SMTP in the Supabase Auth dashboard; 2: real Google sign-in + identity attach to qa-social-only + delete the throwaway), a short **2-case follow-up round (AUTH-S01 full run + AUTH-C07's login leg) closes AUTH entirely** — this is the very next action, not a "someday" item.
