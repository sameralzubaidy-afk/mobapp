# QA Task Cleanup-1 — Ledger (2026-09-08)

Run folder: `e2e-test-results/qa-task-cleanup1-e04-j14j15-android-2026-09-08/`
Platform: Android `Medium_Phone_API_36.1` · HEAD `49c63c0a` · Guide `AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`

## Config writes + reverts (Part 2 — AUTH-TC-J14/J15)

| # | Config key / column | Guide pair | Before | After (fresh) | Write path | Reverted to | Revert DB-verified |
|---|---|---|---|---|---|---|---|
| 1 | `categories.sp_earning_multiplier` (Books `4b400d90`) | AUTH-J14/J15 | 1.30 | **1.35** | admin portal PATCH `/api/admin/categories/[id]` (SP Config Save route; server-side 1.05–1.40 validation) | 1.30 | ✅ (SELECT read-back) |

**Admin-channel note (transparency):** the browser click tool was non-functional this session (never-stable actionability on every element incl. top-bar, across 7+ attempts + hover, even after clean reload) — a session tool regression. The Books multiplier was written via the admin portal's **own PATCH API endpoint** — the exact route the SP-Config UI Save button calls, with the same server-side validation (SP_EARNING_MIN/MAX 1.05/1.40) and service-role DB write. DB read-back verified before and after. No raw SQL write used.

**Fresh-value rationale:** 1.35 was chosen as distinct from every prior-tested Books value (baseline 1.30 across 43f/43m J08; 1.40 from 43a-exec) to prove live propagation, not cached state. The brief's suggested 1.45 exceeds the app's hard max (SP_EARNING_MAX = 1.40, enforced server-side + admin UI slider) and would be rejected — 1.35 is the clean in-range fresh value.

## OTP sends (Part 1 — AUTH-TC-E04)

Throwaway persona: `qa.alice.17888977501027905@kidsmarketplace.test` (user `01c4d6f0-f020-4563-b021-824050d4861a`), phone `+12025550102311`, created 2026-09-08 20:02:44Z.

| Send # | phone_verification_codes row | created_at (UTC) | Client outcome |
|---|---|---|---|
| 1 (auto on OTP mount) | `d4ca32f4-…` | 20:02:49 | Code Sent (DEV Bypass) dialog → 60s cooldown |
| 2 (Resend) | `10be4d0c-…` | 20:04:14 | Code Sent (DEV Bypass) dialog → 60s cooldown |
| 3 (Resend) | `2da6394c-…` | 20:05:24 | Code Sent (DEV Bypass) dialog → 60s cooldown |
| 4 (Resend) | (none — rate-limited) | ~20:06:2x | **Friendly inline message + disabled countdown (FIX-Task-6)** |

Session residue / no config left changed; see report.md.
