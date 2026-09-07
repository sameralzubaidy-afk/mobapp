# QA Task 41 — B0 Dev/Ops Handoffs Filed

Date: 2026-09-06 · Queue: `sameralzubaidy-afk/mobapp` (single triage queue per convention) · Filed via `gh issue create`.

| # | Issue | Unblocks | Link |
|---|---|---|---|
| 14 | Enable "Sign in with Apple" on staging Supabase Auth + Apple test ID + callback URL | AUTH-TC-C03 | https://github.com/sameralzubaidy-afk/mobapp/issues/14 |
| 15 | Reconfigure staging Supabase Auth SMTP (regression since 08-16 PASS) + redirect URL | AUTH-TC-S01 | https://github.com/sameralzubaidy-afk/mobapp/issues/15 |
| 16 | Register Twilio From +19853154226 under US A2P 10DLC | ACC-TC-B03 real-SMS leg | https://github.com/sameralzubaidy-afk/mobapp/issues/16 |
| 17 | Add `qa_local_faq_failure` session-local toggle (mirror `policy_failure`) | ACC-TC-H03 | https://github.com/sameralzubaidy-afk/mobapp/issues/17 |
| 18 | ACC-TC-G09 disposition decision (dead-branch "No session found" fallback) | ACC-TC-G09 | https://github.com/sameralzubaidy-afk/mobapp/issues/18 |
| 19 | Attach a real Google identity to `qa-social-only` persona (a1234567-…-000d) | AUTH-TC-C07 login leg | https://github.com/sameralzubaidy-afk/mobapp/issues/19 |

## Bookkeeping (not a B0 handoff — separate, not urgent)
- **ACC K01–K04 (MFA):** owner-excluded (NOT IMPLEMENTED). Tracker-taxonomy note: `QA-TESTCASE-STATUS-2026-09-03.md` has no NOT-IMPLEMENTED/disposition bucket, forcing K01–K04 into "OPEN". Recommend a legend/roll-up taxonomy fix so MFA reads as a disposition row (like RETIRED/NOT-SUPPORTED) once the owner confirms. Re-scope only when MFA ships.

## Notes
- No duplicate issues existed before filing (only nav-consolidation #11/#12 open).
- Issue bodies carry no credentials; personas referenced by name only.
