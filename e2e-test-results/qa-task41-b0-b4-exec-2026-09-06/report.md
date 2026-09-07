# QA Task 41 — AUTH + ACC Backlog Execution (B0–B4) — Report

- **Date:** 2026-09-06 · **Device:** iPhone 17 Pro Max sim (iOS 26.1, UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`) · **HEAD:** `48347297` · **Staging:** `drntwgporzabmxdqykrp`
- **Call count:** ~148 tool executions (exact `qa:mine-call-ledger` unavailable — transcript not reachable; manual tally)
- **Tracker authority:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (updated atomically, R56/R57)

## Verdict roll-up (this round)

**11 genuine PASS / 0 FAIL / 0 BLOCKED-as-defect / 2 BLOCKED-on-fixture (P03, C07) / B0 = 6 handoffs filed / B3+B4 parked with explicit per-case reasons (R40).**

| Batch | Result |
|---|---|
| B0 | ✅ 6 dev/ops handoffs filed → issues **#14–#19** (`handoffs-filed.md`) |
| Fixture pre-work | ✅ H03 toggle armed→spot-confirm→disarmed (0 residue); `seed:staging` re-run (found P03 unread-fixture skip) |
| B1 reconcile + spot-confirm | ✅ 9 rows flipped to PASS with cited on-record evidence (AUTH H03/L02/P18/P19/Q06; ACC F02/L02/L03/L04); H03 = fresh on-device spot-confirm |
| B2 self-service re-drives | ✅ C05 PASS (provider-unavailable banner), Q04 PASS (both personas) · 🟡 P03, C07 blocked-on-fixture (reasons below) |
| B3 legal cluster | (not driven this session — continuation round; mechanisms ready) |
| B4 G02 | (not driven — fixture-gated) |

**Tracker end-state:** AUTH PASS 118→**125**, OPEN 11→**4** · ACC PASS 57→**61**, OPEN 17→**13**.

## Per-batch detail

### B0 (handoffs — filed so dev/ops work starts in parallel)
Issues in `sameralzubaidy-afk/mobapp`: **#14** Apple/C03 · **#15** SMTP/S01 · **#16** Twilio 10DLC/B03 real-SMS · **#17** `qa_local_faq_failure`/ACC-H03 · **#18** G09 dead-branch disposition · **#19** C07 real Google identity. MFA K re-scope = bookkeeping note only (not urgent).

### B1 (reconcile + spot-confirm)
Each of the 9 was verified against its cited PASS report (verdict + source line) before flipping: L02/P18/P19/Q06/AUTH-L02/ACC-F02/L02/L03/L04 all carry on-device PASS in the cited runs; **H03** additionally got a fresh on-device **spot-confirm** this round:
- Armed `qa_avatar_upload_failure=upload_failure` → fresh signup (Alice autofill, phone dev-bypass `123456`) → Profile Setup → dev avatar → Complete Setup → **Warning "Profile will be created without avatar. You can add it later."** → profile still created ("Your profile has been created!") → DB read-back `qa.alice.17887204905099267`, `avatar_url = NULL`, phone-verified, node Norwalk Central. Non-blocking path confirmed on the current build. Disarmed afterward (DB-verified `none`).

### B2 (self-service re-drives)
- **C05 PASS:** armed `qa_provider_unavailable=google` → Login → tap Google → inline **"Google is temporarily unavailable. Sign in with email instead?"** + `provider-error-cta` → tap → banner clears, email login usable; no provider browser opened. Disarmed.
- **Q04 PASS (both personas):** Help → SP Calculator → Books → $25.
  - **test-buyer (subscriber):** cash after SP **$8.00**, platform fee **$1.49**, total **$9.49** (17 SP max usable).
  - **test-free:** cash **$8.00**, fee **$20.00**, total **$28.00**.
  - Fee matches live config exactly (`transaction_fee_subscriber_cents=149`, `transaction_fee_non_subscriber_cents=2000`) — the Q04 subscriber-fee defect is closed on the current config.
- **P03 = BLOCKED (fixture):** test-buyer has 11 messages but **0 unread** (MSG I05 reset); re-seeding does **not** restore an unread — the seed's P03 unread fixture **skips** (`seed-staging-data.ts:1080` idempotency guard: its target — buyer's oldest trade — already has seller messages). All existing buyer↔seller conversations are on terminal trades (frozen chat), and pending offers have no chat surface until accepted (accepting mutates shared trade fixtures). Original blocker (zero messages) is resolved; residual = clean unread-message fixture.
- **C07 = BLOCKED (fixture + #19):** verified `qa-social-only` **now has a bcrypt password** (`$2a$`, 60 chars) → `can_set_password()` false → Set Password modal unreachable even after an identity attach. Standing password-less fixture has drifted to password-bearing (fixture regression — dev to NULL `encrypted_password`); real Google identity still owed (#19).

## Findings
1. **[Fixture] seed P03 unread-message fixture skips** when the target trade already has a seller message — re-seeding does not refresh the unread state. Fix: guard should target a fresh/no-message trade or create unconditionally.
2. **[Fixture regression] `qa-social-only` is no longer password-less** (bcrypt hash present) — C07 precondition broken; dev to NULL `encrypted_password` + attach real Google identity (#19).
3. **[Doc-drift] Q04 guide fee example** is $1.00 but the live subscriber config is $1.49 (changed in QA Task 21) — update the guide example (model is correct; R36 live-config authoritative).

## Cross-cutting
- **Design & copy:** all driven screens/dialogs (profile setup, login, SP calculator, GlobalAlert alerts) on canonical tokens; C05 banner copy parent-appropriate; no raw machine strings surfaced (R58 clean).
- **Load time (perceived):** all transitions sub-3s (signups/logins ~1s, calculator updates instant). Verdict GOOD.
- **No app defects found** this round; the two blocks are fixture-state, not code.

## Cleanup / App state left behind
- Toggles disarmed (DB-verified `none`): `qa_avatar_upload_failure`, `qa_provider_unavailable`.
- `seed:staging` re-run → standard personas + standing fixtures at canonical seed state; test-buyer/test-seller gained 3 fresh pending offers (seed's standard).
- Throwaway H03 user `qa.alice.17887204905099267@…` = cleanup candidate.
- App logged out (Landing). Admin portal untouched. Tracker updated atomically.

## Suggested next session
1. Continuation round for **B3 legal cluster** (J07/J12/J08 via `policy_failure` toggle; J02 via an email/password persona with unaccepted TOS; J05 via admin `/policies` publish + fresh-launch re-prompt) — mechanisms all ready.
2. **B4 G02** after a dedicated fixture session provisions a payment-fail persona + ≤7d-trial persona (test-trial currently absent — deleted in QA Task 40).
3. **P03** after a dev seed-fix or a disposable pending-offer accept+message session.
4. **C07** after dev NULLs `encrypted_password` (#19).
5. Re-run once the B0 env items land: C03 (Apple), S01 (SMTP), B03 real-SMS leg (10DLC).
