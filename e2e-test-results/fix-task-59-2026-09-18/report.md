# FIX-Task-59 — `verify_user_phone` unauthenticated access hole

**Date:** 2026-09-18 · **Environment:** staging (`drntwgporzabmxdqykrp`) · **Status:** ✅ **CLOSED & VERIFIED**

---

## 1. Verdict in one paragraph

The hole was real and **worse than reported**: three separate unauthenticated paths could mark *any* account's phone as verified, and fixing only the one QA named would have been security theatre. All three are now closed on staging and verified through the real credentials a caller would use. The legitimate verification flow is unaffected — proven by a positive leg in the same run that blocked the attacks.

---

## 2. Before — measured live (read-only `pg_proc` / `pg_policy` introspection)

### 2.1 The RPC

```
verify_user_phone(p_user_id uuid, p_phone text)
  SECURITY DEFINER, search_path=public
  proacl      = postgres=X/postgres | service_role=X/postgres | anon=X/postgres | authenticated=X/postgres
  anon_can_execute = TRUE
  body        = UPDATE public.profiles ... WHERE p.user_id = p_user_id   ← no identity check of any kind
```

Any caller — with no login at all — could pass any `p_user_id` and stamp that account as phone-verified. Since FIX-Task-58 made `profiles.phone_verified_at` the single source of truth gating publish and purchase, this meant the gate could be bypassed for any account.

### 2.2 Two more paths to the same field — the finding that changed the fix

| Policy | Command | Roles | Predicate |
|---|---|---|---|
| `profiles_anon_update` | UPDATE | `anon` | **`true`** (any row, any values) |
| `Allow phone verification updates` | UPDATE | **PUBLIC** | `auth.uid() = user_id` **OR** (`auth.role() = 'anon' AND user_id IS NOT NULL`) → true for every row |

So an anonymous caller could also just `PATCH /rest/v1/profiles?user_id=eq.<any>`. **Revoking the RPC alone would not have closed the gate.**

### 2.3 A completeness scan found three more anon-reachable entry points

Scanning every `public` function whose body mentions `phone_verified`:

| Function | `anon` EXECUTE | Security | Note |
|---|---|---|---|
| `verify_phone_code(p_user_id, p_code)` | TRUE | **INVOKER** | writes `phone_verified_at` |
| `is_phone_verified(p_user_id)` | TRUE | DEFINER | reads anyone's status anonymously |
| `check_phone_verification_status(p_user_id)` | TRUE | DEFINER | returned **name / email / phone** to unauthenticated callers |
| `admin_get_user_detail(p_admin_id, p_user_id)` | TRUE | DEFINER | different class → reported, not fixed (§6) |

`profiles.user_id` is `UNIQUE`, so the surviving anon INSERT rule cannot forge a second row for an existing account — that path is not a bypass.

---

## 3. What changed (all in one migration, Mode B / idempotent)

**File:** `supabase/migrations/20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql`

1. **`verify_user_phone` — identity gate added, success path preserved verbatim.** Identity is `auth.uid()`-derived and takes precedence: a user JWT may only verify *its own* phone. With no `auth.uid()` (anon, service role, DB context) the caller must be `service_role`. Denials `RAISE` with `ERRCODE 42501` so a rejection can never be confused with the benign `{success:false}` a "no profile found" result returns. Mirrors the in-repo sibling `20260916000135_dev_task_57_rpc_identity_lockdown.sql`, including its `current_setting('role', true)` signal (never `request.jwt.claim.role`, per BP-78).
2. **Grants** — `REVOKE ... FROM PUBLIC, anon`; `GRANT ... TO authenticated, service_role` (re-asserted after the `CREATE OR REPLACE`, because the DT-61 guard strips grants — BP-79).
3. **`DROP POLICY` × 2** — the two anonymous/PUBLIC write rules on `profiles`.
4. **`REVOKE ... FROM PUBLIC, anon`** on the three sibling functions.

**Rollback** (one line each, in the migration header): re-`GRANT` to `PUBLIC` for the siblings, recreate the two policies, and re-apply `20260918000002` for the body. Restoring the policies **reopens the bypass** — the header says so explicitly.

### 3.1 A correction made mid-task (recorded deliberately)

The first attempt revoked the three siblings **from `anon` only** — and **it silently did nothing**. Each still carried the built-in `=X/postgres` **PUBLIC** grant, and `anon` inherits EXECUTE *through* PUBLIC; a revoke from a named role cannot remove an inherited privilege. Live re-check: `anon_can_execute` was still `TRUE` for all three. The corrected statement revokes from `PUBLIC, anon` and then re-asserts the explicit grants (now load-bearing, since dropping PUBLIC removes the inherited path for every non-owner role). This trap is now recorded in BP-79 (canonical rule text + detection checklist).

---

## 4. After — verified live

### 4.1 Grants (live `pg_proc`)

| Function | `anon` before | `anon` after | `authenticated` | `service_role` | ACL (`=X` = PUBLIC) |
|---|---|---|---|---|---|
| `verify_user_phone` | TRUE | **false** | true | true | `postgres, service_role, authenticated` |
| `verify_phone_code` | TRUE | **false** | true | true | `postgres, authenticated, service_role` |
| `is_phone_verified` | TRUE | **false** | true | true | `postgres, authenticated, service_role` |
| `check_phone_verification_status` | TRUE | **false** | true | true | `postgres, authenticated, service_role` |

`verify_user_phone` live body contains the `auth.uid()` gate.

### 4.2 Remaining UPDATE rules on `profiles` — both anon paths gone

| Policy | Roles | Predicate |
|---|---|---|
| `Users can update their own profile` | PUBLIC | `auth.uid() = user_id` ✅ legitimate |
| `Service role can update profiles` | PUBLIC | `auth.role() = 'service_role'` ✅ legitimate |

`profiles_anon_update` and `Allow phone verification updates` **no longer exist**. (Signup does not depend on either: the `handle_new_user()` trigger creates the profile row as table owner, RLS-exempt — verified in `src/services/auth.ts`.)

### 4.3 Functional proof — `npm run qa:fix59-phone-lockdown` (6/6 PASS)

New probe `p2p-kids-marketplace/scripts/qa/fix-task-59-phone-rpc-lockdown.mjs`. It creates **two disposable users**, and every read-back goes through the service-role client so it proves *database* state rather than what the caller was told.

| Leg | Caller | Action | Result |
|---|---|---|---|
| SETUP | service | both users unverified baseline | ✅ `phone_verified_at IS NULL` |
| **LEG 2** | **anon key, no session** | RPC targeting A | ✅ rejected — `42501 permission denied for function verify_user_phone`; A still NULL |
| **LEG 2b** | **anon key** | direct `PATCH` A's row | ✅ 0 rows affected; A still NULL |
| **LEG 3** | signed in **as A** | RPC targeting **B** | ✅ `42501 You can only verify your own phone number`; **neither** row changed |
| **LEG 3b** | signed in **as A** | direct `PATCH` B's row | ✅ 0 rows; B still NULL |
| **LEG 1** | signed in **as B** | RPC targeting **own** id | ✅ `success:true`, `phone_verified_at` set, `phone_verified(derived)=true`, `phone = +15550000102` |

LEG 1 is the **positive test required by the task**: the legitimate signed-in self-verification still works end-to-end, and it also confirms the FIX-Task-58 derived mirror still produces `phone_verified` from the timestamp. LEG 1 and LEG 3 are the *same call shape* — one allowed, one blocked — so the gate is discriminating, not blanket.

### 4.4 Integration suite (E2E-gated) — 3/3 PASS

`RUN_SUPABASE_E2E=true npx jest src/services/__tests__/verify_user_phone.integration.test.ts`

- `returns error when no verified code exists` ✓
- `marks profile verified when a verified code exists` ✓ (now driven through the privileged client)
- `rejects a caller who is not the target account (FIX-Task-59)` ✓ **new**

**Why the first two changed (BP-57):** that suite previously called the RPC from the **anon** app client with an arbitrary `testUserId` and asserted success — i.e. it asserted the *vulnerability*. It now asserts the corrected rule and additionally proves the target row is genuinely untouched. The fix was not weakened to keep old tests green.

### 4.5 Tier 0

| Gate | Result |
|---|---|
| ESLint (changed files) | ✅ **PASS** — 0 errors (8 pre-existing `no-console` warnings elsewhere in `devTestingService.ts`, none added) |
| Jest (affected suites) | ✅ **PASS** — 69 passed, 3 skipped, 0 failed |
| TypeScript (`tsc -p tsconfig.json --noEmit`) | ⚠️ **RED — pre-existing, unrelated.** Exactly one error: `src/utils/localImageFileSize.ts:31` `TS2353 … 'size' does not exist in type 'InfoOptions'`. That file is **untracked work from another task** (with `photoRules.ts`, `uploadFailureFormat.ts`, modified `photoService.ts` / `listing.ts`), and **zero errors are reported in any file FIX-Task-59 touched** |

---

## 5. Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql` | **New** — the 4 changes above + verified rollback lines |
| `p2p-kids-marketplace/scripts/qa/fix-task-59-phone-rpc-lockdown.mjs` | **New** — the 6-leg probe |
| `p2p-kids-marketplace/package.json` | **+1 script** — `qa:fix59-phone-lockdown` |
| `p2p-kids-marketplace/src/services/__tests__/verify_user_phone.integration.test.ts` | Updated to the new model + new negative test |
| `p2p-kids-marketplace/src/services/devTestingService.ts` | Comment only — documents the KNOWN LIMITATION in §6.1 (see below) |
| `.github/instructions/supabase-sql.instructions.md` | BP-79: the PUBLIC-vs-named-role revoke trap + detection checklist |

**Applied via `mcp_supabase_apply_migration`, so it will not appear in `list_migrations` (BP-81).** Liveness was therefore verified by *invoking* the changed objects (probe LEG 1 + the live ACL/policy reads above), not by the migration list.

---

## 6. Known gaps and out-of-scope findings (owner decisions, not silently carried)

### 6.1 The DEV dummy-user auto-verify path is now degraded — **needs an owner decision**
`devTestingService.bypassOTPVerification` is called by the DEV "create dummy user" flow with a **freshly-created user's id** while the app session belongs to someone else. Under the new rule that call is correctly denied, so that flow's phone auto-verify step now returns `success:false`; its caller logs a warning and continues.

I attempted to route it through its own service-role client and **reverted that attempt**, for a concrete reason: the app bundle never receives `SUPABASE_SERVICE_ROLE_KEY` (Expo inlines only `EXPO_PUBLIC_*`), so `getServiceRoleClient()` returns `null` at app runtime — the change would have been inert on device while breaking `verification.unit.test.ts` (confirmed by a control run: blank the key → test passes; present → fails). Leaving a half-measure in place was worse than reporting it.

**Recommendation:** verify the new user **server-side** (an Edge Function on service role), or have that DEV flow sign in as the user it just created. Until then, DEV dummy-user phone auto-verify does not work — the warning is visible.

### 6.2 Reported, deliberately not fixed (different class / own blast-radius analysis)
- **`admin_get_user_detail(p_admin_id, p_user_id)` is `anon`-executable** (SECURITY DEFINER). Whether it is exploitable depends on how it validates `p_admin_id`; it is an admin surface, not the phone gate, so it needs its own caller analysis. **Recommended next task.**
- **`enforce_phone_verified_on_item_insert()` is `anon`-executable.** It is a trigger function (PostgREST does not route `trigger`-returning functions), so residual risk is low — hygiene only.
- **`profiles_anon_select` (`anon`, `USING true`)** exposes every profile to unauthenticated callers, and **`profiles_anon_insert` (`anon`, `WITH CHECK true`)** is still permissive (not exploitable for verification, since `profiles.user_id` is UNIQUE).
- **`setup_user_profile(uuid, text, text)`** is `anon`-callable and rewrites another user's `name`/`zip_code` — an authorization hole, but it cannot reach `phone_verified_at`.
- **No denial logging added.** Rejected attempts leave no trace. `admin_audit_logs` is the proper sink if the owner wants it.
- **A self-verify short-cut still exists by design:** an authenticated user can set their own `phone_verified_at` through the normal `profiles` self-update path (this is what the real flow `phoneService.verifyPhoneCode` does after verifying the OTP). A malicious user can therefore skip *their own* OTP — but can no longer touch anyone else's account. Tightening that would require server-side OTP verification as the only writer (a larger, separate change).

---

## 7. Scope note (per Scope Containment)

The task named one function; this change touches **6 files** because the one-function fix would not have closed the gate. Each extra file is justified above: 2 extra DB objects of the same class (the anon write policies — without them the negative test passes while the attack still works), 3 sibling functions of the same signal, and 1 new probe + 1 updated test as the required evidence. Scope was confirmed with Samer before each write.
