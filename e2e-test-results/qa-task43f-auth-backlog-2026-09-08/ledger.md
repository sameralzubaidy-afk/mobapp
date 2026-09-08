# QA Task 43f — Ledger

**Date:** 2026-09-08 · **Platform:** Android `Medium_Phone_API_36.1` · **Run:** `e2e-test-results/qa-task43f-auth-backlog-2026-09-08/`

## Verdict table

| TC-ID | Guide | Verdict | Top finding / evidence |
|---|---|---|---|
| AUTH-TC-O04 | AUTH | ✅ PASS | Free-user leg: SP filter ON → upgrade CTA + 50 SP results w/ badges; toggle OFF reverts (43c PARTIAL → now full PASS on Android) |
| AUTH-TC-B01 | AUTH | ✅ PASS | Incomplete-onboarding leg: mid-onboarding persona → onboarding carousel (not Home tabs); both legs now PASS |
| AUTH-TC-Q01 | AUTH | ✅ PASS | Published-only 4 sections ordered 1-4 (DB + Help tree match) |
| AUTH-TC-Q02 | AUTH | ✅ PASS | Section-by-type accordion expands single published section (tracker PARTIAL superseded → flipped PASS) |
| AUTH-TC-Q03 | AUTH | ✅ PASS | Sell mode Books/$25 → 33 SP = round(25×1.30), no hardcoded rates |
| AUTH-TC-Q04 | AUTH | ✅ PASS | Buy mode Books/$25 free → Max 17 SP, cash $8.00, fee $20.00 (cfg 2000), total $28.00 |
| AUTH-TC-Q05 | AUTH | ✅ PASS | Bonus ⭐ on Books/Toys/Electronics/Art&Crafts (DB set matched); sell badge + 1.3× |
| AUTH-TC-Q06 | AUTH | ✅ PASS | help_view/calculator_use/section_expand landed live in education_analytics, no throw |
| AUTH-TC-Q07 | AUTH | ✅ PASS | Prompt state machine source+DB (shouldShowOnboarding/idempotent markPromptSeen/suppression) |
| AUTH-TC-J01 | AUTH | ✅ PASS | Photo-first gating: form hidden until photo, shown after (1/10) |
| AUTH-TC-J03 | AUTH | ✅ PASS | Required-field validation: publish disabled until valid (functional no-op) |
| AUTH-TC-J04 | AUTH | ✅ PASS | Condition 5 / Age 5 / Gender 4 / Color 12-grid options render |
| AUTH-TC-J05 | AUTH | 🟡 PARTIAL | Other category + Custom Category Name * + admin-review helper render; blocked-submit source-verified only (Android field-clear tooling limit) |
| AUTH-TC-J06 | AUTH | ✅ PASS | Subscriber Accept SP toggle → "✓ SP Eligible" badge |
| AUTH-TC-J08 | AUTH | ✅ PASS | SP earnings preview "~26 SP" = 20×1.30 Books (subscriber branch) |
| AUTH-TC-J09 | AUTH | ✅ PASS | Submit → "Thanks for submitting!" + DB pending item 73670a8f + My Items PENDING hint |

**Roll-up:** 15 ✅ PASS · 1 🟡 PARTIAL · 0 FAIL · 0 BLOCKED · 0 SKIPPED.

## Perceived load-time table (simulator wall-clock, ±polling precision — not a formal profile)

| Screen → transition | Elapsed | Flagged? |
|---|---|---|
| Landing → Login (O04/B01) | <3s | no |
| Login → onboarding carousel (B01) | <3s | no |
| SpWallet → Help (education) | <3s | no |
| Help: SP category modal select → Books | <3s | no |
| Discover: SP filter apply → 50 results | <3s | no |
| ItemCreate: Submit → success modal | <3s | no |
| Dev-client cold bundle → Landing (R79-1 checks) | ~6–10s | no — dev-build cold-start artifact, not app behavior |

## Session end state
- test-seller / test-free / qa.alice.17888198382012019@ all logged OUT.
- Item `73670a8f` pending (test-seller) — staged Group-L fixture (intentional).
- No drafts created, no admin_config writes, no toggles armed.
- Call ledger: 356 tool executions / 323 msgs (mined, R71).
