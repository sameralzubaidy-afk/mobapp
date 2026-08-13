# Stage 5 — Auth-Identity Teardown Report (staging `drntwgporzabmxdqykrp`)

**Date:** 2026-08-12
**Scope:** Delete orphaned Auth identities + profiles left by pilot Stages 1–4.
**Mechanism:** GoTrue Auth Admin API (`DELETE /auth/v1/admin/users/{uid}`) — NOT raw SQL on `auth` schema.
**Result:** 13/13 accounts fully removed (Auth identity + `profiles` row). 0 errors.

---

## 1. Phase 1 — Findings (mechanism + empirical cascade result)

- **No Management API PAT** (`SUPABASE_ACCESS_TOKEN`) exists on this machine (searched repo env files, shell configs, `~/.supabase/`). The available Admin credential is the **legacy-JWT service-role key** (`SUPABASE_SERVICE_ROLE_KEY` in `p2p-kids-marketplace/.env.staging`), which works with the GoTrue **Auth Admin API**.
- **Empirical cascade test** (single disposable account `stage4.s0.acc1.1786533400@example.com`):
  - Deleted its Auth identity via Admin API → response `{}` (success).
  - Read-back: `auth.users` → `[]` and `public.profiles` → `[]`.
  - **Observed result: deleting the Auth identity alone cascade-deletes the `profiles` row (`ON DELETE CASCADE`), even when the profile was previously soft-deleted (`deleted_at` set).** No additional cleanup step is required.

---

## 2. Phase 2 — Candidate List (13 accounts, all positively identified pilot test data)

| # | Email | Source | Auth UID | profiles before |
|---|---|---|---|---|
| 1 | `rewardsfirsttradebobauto.demo@example.com` | Stage 1 | `74cec653-…` | active |
| 2 | `alice.stage3.0811@example.com` | Stage 3 | `4ef0c936-…` | active |
| 3 | `qa.otp.verify.1786479747@example.com` | Stage 3 | `954c05d6-…` | active |
| 4 | `bob.stage3.1786481365@example.com` | Stage 3 | `586fb634-…` | active |
| 5 | `bob.stage3.dl.fix.1786484977@example.com` | Stage 3 | `0ad281b4-…` | active |
| 6 | `stage4.s0.acc1.1786533400@example.com` | Stage 4 | `c085d06a-…` | soft-deleted (empirical test) |
| 7 | `stage4.s0.acc2.1786533400@example.com` | Stage 4 | `277c2df7-…` | soft-deleted |
| 8 | `stage4.s2.acc1.1786534989@example.com` | Stage 4 | `2264dad0-…` | soft-deleted |
| 9 | `stage2.referral.invalid.demo@example.com` | Stage 2 (found) | `557cf880-…` | active |
| 10 | `stage2.referral.valid.demo@example.com` | Stage 2 (found) | `27a77600-…` | active |
| 11 | `stage3.underage.demo@example.com` | Stage 3 (found by scan) | `98c6328d-…` | active |
| 12 | `bob.stage3.dl.1786483702@example.com` | Stage 3 (found by scan) | `ade0ea0a-…` | active |
| 13 | `bob.stage3.dl.clean.1786484166@example.com` | Stage 3 (found by scan) | `2e9e8e42-…` | active |

**Excluded (not deleted):**
- 81 pre-pilot look-alikes (2025-12 → 2026-07, `bob.demo@example.com` family) — NOT positively identified as this pilot's data → flagged for separate human review.
- Standing test-buyer accounts (see §4).

---

## 3. Phase 3 — Execution Log

All deletions via Admin API; read-back verification immediately after.

| # | Email | Auth delete | `auth.users` after | `profiles` after |
|---|---|---|---|---|
| 1 | `rewardsfirsttradebobauto.demo@example.com` | HTTP 200 | gone | gone (cascade) |
| 2 | `alice.stage3.0811@example.com` | HTTP 200 | gone | gone |
| 3 | `qa.otp.verify.1786479747@example.com` | HTTP 200 | gone | gone |
| 4 | `bob.stage3.1786481365@example.com` | HTTP 200 | gone | gone |
| 5 | `bob.stage3.dl.fix.1786484977@example.com` | HTTP 200 | gone | gone |
| 6 | `stage4.s0.acc1.1786533400@example.com` | HTTP 200 (empirical) | gone | gone |
| 7 | `stage4.s0.acc2.1786533400@example.com` | HTTP 200 | gone | gone |
| 8 | `stage4.s2.acc1.1786534989@example.com` | HTTP 200 | gone | gone |
| 9 | `stage2.referral.invalid.demo@example.com` | HTTP 200 | gone | gone |
| 10 | `stage2.referral.valid.demo@example.com` | HTTP 200 | gone | gone |
| 11 | `stage3.underage.demo@example.com` | HTTP 200 | gone | gone |
| 12 | `bob.stage3.dl.1786483702@example.com` | HTTP 200 | gone | gone |
| 13 | `bob.stage3.dl.clean.1786484166@example.com` | HTTP 200 | gone | gone |

Final read-back: `SELECT email FROM auth.users WHERE email IN (13 emails)` → `[]`; `SELECT email FROM public.profiles WHERE email IN (13 emails)` → `[]`. **13/13 verified removed.**

---

## 4. Standing Test-Buyer Accounts — Confirmed NOT Touched

| Email | Auth identity | `profiles` | Status |
|---|---|---|---|
| `rewardsfirsttradebob.demo@example.com` | present (2026-02-01) | active, not deleted | ✅ untouched (signed in 2026-08-12) |
| `seller2bob.demo@example.com` | present (2026-07-06) | active, not deleted | ✅ untouched |

---

## 5. Phase 4 — Reusable Teardown Procedure (for future stages)

### How to safely delete a pilot-created test account

1. **Confirm staging first (non-negotiable):** project URL must resolve to `https://drntwgporzabmxdqykrp.supabase.co` (cross-check `p2p-kids-marketplace/.env.staging`).
2. **Positively identify the account:** it must be on the known-stray list OR match pilot markers (synthetic `@example.com` domain + `.demo`/`stageN.` naming + created during a pilot stage). Never delete on a "similar-looking" guess.
3. **Never touch the standing accounts:** `rewardsfirsttradebob.demo@example.com` and `seller2bob.demo@example.com`.
4. **Enumerate + confirm:** list every target (email, uid, `profiles` status) and get explicit human sign-off before deleting.
5. **Delete via the Auth Admin API (not raw SQL on `auth` schema):**
   ```bash
   SRK=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.env.staging | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
   curl -sS -X DELETE "https://drntwgporzabmxdqykrp.supabase.co/auth/v1/admin/users/<uid>" \
     -H "Authorization: Bearer $SRK" -H "apikey: $SRK"
   ```
   Response `{}` = success; `404` = already gone.
6. **Know the cascade behavior (empirically confirmed 2026-08-12):** deleting the Auth identity **alone** also removes the `profiles` row via `ON DELETE CASCADE` — including soft-deleted rows. **No extra step needed.**
7. **Verify by read-back:** confirm `auth.users` and `public.profiles` return no rows for each deleted email, and that the standing accounts still exist.
8. **Never handle the service-role key yourself** — the operator runs the command; the key stays in `.env.staging`.

### Helper recommendation

**Yes — keep a lightweight helper, as a documented manual dev script (not app code).** `temp/stage5-auth-teardown.sh` is the current session-scoped helper. For future stages, promote it to a **parameterized** form (`teardown-accounts.sh <uid|email> …`) that looks up UIDs by email, prints the enumerated list for confirmation, then deletes via the Admin API. Do NOT gate it into the mobile app — keep it a standalone dev tool so no `__DEV__`/staging gate is needed in app code.

---

## 6. Safety Compliance Check

- ✅ **Staging verified throughout:** every read/write used `project_id = drntwgporzabmxdqykrp`; URL cross-checked against `.env.staging`.
- ✅ **Every deletion matched a positively-identified pilot test account** (13/13; no look-alikes or standing accounts).
- ✅ **No raw SQL against the `auth` schema:** all deletions via the GoTrue Auth Admin API; only read-only `SELECT`s touched `auth.users` for verification.
- ✅ **Enumerated list confirmed before deletion** (Phase 2 gate) including the 3 newly-discovered accounts.
- ✅ **Extra confirmation layer honored:** the human operator executed every deletion; the agent never handled the service-role key.
- ⚠️ **Preflight note:** git working tree was not clean at start (uncommitted Stage 4 / gap-analysis artifacts) — unrelated to this cleanup, left untouched.
