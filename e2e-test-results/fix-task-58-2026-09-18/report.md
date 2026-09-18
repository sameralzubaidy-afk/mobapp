# FIX-Task-58 — Phone-Verification Data Integrity + Seed/Tooling Fixes

**Date:** 2026-09-18 · **Source:** AUTH Android Round 2 (`e2e-test-results/qa-auth-android-jk-r2-2026-09-18/`) · **Platform verified:** iOS Simulator (iPhone 17 Pro Max, iOS 26.1) + live staging (`drntwgporzabmxdqykrp`)

---

## 0. Root cause the QA report left open (§9.1a — stated stance: CONFIRMED)

F1 was filed as *observed state* with the writer explicitly **not established** (correctly, per R100). Tracing every writer of `phone_verified` establishes it conclusively:

**`profiles.phone_verified_at` is the single source of truth. `profiles.phone_verified` is a legacy boolean that four independent code paths wrote ALONE — with no timestamp — while both gates read only the timestamp.**

| Writer of `phone_verified` | Set `phone_verified_at`? |
|---|---|
| `src/services/profile.ts` (Profile Setup) | ✅ both |
| `src/services/phoneService.ts` (dev bypass **and** real verify) | ✅ both |
| `src/services/phone.ts` | ✅ both |
| `src/services/supabase/auth.ts` (signup fallback) | n/a — writes `false` |
| **`scripts/seed-staging-data.ts` profile upsert** | ❌ **boolean only** |
| **7 QA fixture scripts** (`provision-linked-provider-fixture.ts`, `qa/payout-fixture.mjs`, `qa/qa-payfail-fixture.mjs`, `qa/qa-payfail-retry-fixture.mjs`, `qa/r41-first-trade-free.mjs`, `qa/r41-trial-fixture.mjs`, `qa/wallet-persona-fixture.mjs`) | ❌ **boolean only** (`grep phone_verified_at scripts/**` returned **zero** hits before this change) |
| **RPC `verify_user_phone(uuid,text)`** — replaced by `20260916000093_ultimate_test_alignment_fix.sql` (16 Sep) | ❌ **dropped the `phone_verified_at = NOW()` line** the earlier `20251215000002`/`0003` versions had |
| QA's documented "scoped restore" (`phone_verified_at = NULL` only — `qa-task43h` ledger L17) | — preserved the drift |

**The gates the disagreement mattered for** (both read the timestamp, never the boolean):
- client `isPhoneRequired()` — `src/services/phoneService.ts`
- server `public.is_phone_verified(uuid)` — migration `20260819000001`, BEFORE INSERT trigger on `items`

**Consumers that were reading the drift-prone boolean** (and were therefore lied to): `EditProfileScreen.startPhoneVerificationFlow`, the `AuthSession` signature in `AuthContext`, and the admin `/users` detail panel.

**Corroborating device evidence of the old behaviour** — two items created **3 ms apart** at `12:57:15.287` / `12:57:15.29`, the signature of the double-verify. Today's run produced a **single** item.

**A second, independent tooling defect in the same button** was found and fixed in the same pass, because fixing only the tap would have made the duplicate *worse* (see §3).

---

## 1. Item 1 — Single source of truth established ✅

**Decision:** `profiles.phone_verified_at IS NOT NULL` is the single source of truth. `profiles.phone_verified` is now a **derived mirror**.

**`supabase/migrations/20260918000002_fix_task_58_phone_verified_source_of_truth.sql`** (Mode B, applied to staging):
1. **Backfill** — sets `phone_verified = (phone_verified_at IS NOT NULL)` for every row where the two disagree, in **both** directions.
2. **Derivation trigger** `trg_profiles_sync_phone_verified` (BEFORE INSERT OR UPDATE on `profiles`) — derives the mirror on every write, so it cannot drift again. It only ever overwrites `phone_verified`; it never touches `phone_verified_at` or any other column.
3. `COMMENT ON COLUMN` documenting the invariant on the column itself.
4. **Repaired the live writer** — `verify_user_phone(uuid,text)` now stamps `phone_verified_at = COALESCE(phone_verified_at, now())` (a re-verify keeps the original time). Without this the derivation trigger would have silently turned that RPC into a no-op.
5. Re-asserted the RPC's pre-existing EXECUTE grants (replacing a function strips them — BP-79).

**Why a coercing trigger, not a rejecting CHECK:** a `CHECK` would make the 8 provisioning writers fail loudly and partially-provision staging. A self-healing derivation is order-independent and cannot be reintroduced.

**Verification — local dry-run first** (real Postgres 17.6.1 in `supabase_db_kids_marketplace_app`, minimal `profiles` stub, then cleaned up):

| Check | Result |
|---|---|
| Backfill on 4 fixture rows (1 inconsistent each way, 2 consistent) | `UPDATE 2`; inconsistent row → `false`, reverse-inconsistent → `true`, consistent rows untouched |
| Invariant violations | **0** |
| Trigger installed + enabled | 1 row, `tgenabled = 'O'` |
| Write the boolean **alone** | re-derived back to `false` — the mirror genuinely cannot drift |
| Invoke the repaired RPC **live** (BP-90) | `{"success": true, …}`; `phone_verified = true`, `phone_verified_at` stamped |
| Re-verify | original timestamp preserved (COALESCE) |
| Idempotency (re-ran the file twice more) | `UPDATE 0`, no errors, still exactly 1 trigger, invariant still 0 |

**Verification — live staging (read-back, not the migration list — BP-81):**

| Check | Result |
|---|---|
| Invariant violations, **all** profiles | **0** |
| `trg_profiles_sync_phone_verified` | present, `tgenabled = 'O'` |
| RPC body contains the timestamp write | `true` |
| `has_function_privilege(authenticated \| anon, verify_user_phone)` | `true` / `true` (grants survived) |
| `sync_profile_phone_verified()` executable by `authenticated` | `false` (correct — clients must not call it) |
| Live invocation on a non-existent user | `{"success": true}` with **0 rows mutated** (proves the body runs end-to-end with no side effect) |

**Consumer fixed:** `EditProfileScreen.startPhoneVerificationFlow` now derives "already verified" from `phone_verified_at` instead of the boolean. `auth.users.phone` is retained there as a **match target only**, never as a verification signal.

### ⚠️ Deliberately NOT changed — `auth.users.phone` (flagged, needs your decision)
The brief lists `auth.users.phone` as the third disagreeing field. It is **not** part of this invariant, deliberately:
- It is **GoTrue's own record**, written by a *different surface* — the phone-**CHANGE** flow via the `auth-update-phone` Edge Function. The onboarding/listing **verify** flow (`phoneService.verifyPhoneCode`) provably never writes it.
- It is therefore legitimately `NULL` for any account provisioned by the seed (users are created via `admin.createUser`, which is not given GoTrue's `phone` field).
- Nothing in the app should read it as a verification signal — and the one place that did (`EditProfileScreen`) now reads the source of truth instead.

Making the verify path write `auth.users.phone` would mean invoking an Edge Function on every verification and would change *which number GoTrue considers the account phone* — a product decision, so it is surfaced here rather than implemented. **Recommendation:** accept "verified-ness lives in `profiles.phone_verified_at`; `auth.users.phone` is the change-flow's record" and treat the two as different facts. If you would rather they be kept in lockstep, that is its own small task.

### ⚠️ Pre-existing security defect found (NOT changed — out of scope)
`verify_user_phone(uuid, text)` takes an **arbitrary `p_user_id` with no identity check** and is granted to **`anon` and `authenticated`** (`20260916000093` line 898). That means any caller — including an unauthenticated one — can mark **any** account's phone as verified. This is a BP-78 violation and would normally be a P0. I re-asserted the existing grants unchanged (so this task introduces no privilege change) and flag it for its own task. **Recommendation:** restrict to `authenticated` + add an `auth.uid() = p_user_id OR admin_has_role(auth.uid())` guard. Note its only app callers are `verification.ts` (dead code — imported only by its own unit test) and `devTestingService.bypassOTPVerification`.

---

## 2. Item 2 — `seed:staging` restores `test-free`'s unverified baseline ✅

**Why it was broken:** `signupTestUser()` **early-returns** for a persona that already exists, so its profile upsert — the only place carrying the phone fields — never re-runs. A persona's phone state was frozen at whatever the last run left behind. `signupTestUser`'s upsert also wrote `phone_verified: true` **without** the timestamp, so every freshly-provisioned persona was born in the F1 shape.

**Fix:** a new `seedPhoneVerificationBaseline()` step that runs on **every** seed (basic *and* `--extended`), after all personas are created:
1. Resets `test-free` to `phone_verified = false`, `phone_verified_at = NULL`, `phone_verification_method = NULL`.
2. Self-heals every other standing persona to verified — touching **only** rows whose timestamp is still `NULL`, so a genuine verification time is preserved (`noProfileUser`/B09 is excluded — it has no profile row by design).
3. **Reconciliation gate:** reads back all 13 standing personas and **exits non-zero** if the mirror disagrees with the source of truth for any of them.

**Evidence — first seed run (before driving J10):**
```
✓ UNVERIFIED baseline restored (phone_verified_at IS NULL): test-free@kidsmarketplace.test
✓ VERIFIED baseline ensured for 12 personas (10 healed from an unverified state)
✓ Reconciliation OK — 13 standing personas agree (phone_verified mirrors phone_verified_at)
```
→ **10 personas were healed** — i.e. ten accounts were sitting in exactly the F1 shape. That independently confirms the writer tracing.

**Evidence — the J10 round consumed the baseline, then one seed command restored it (re-runnability proven):**
```
✓ UNVERIFIED baseline restored (phone_verified_at IS NULL): test-free@kidsmarketplace.test
✓ VERIFIED baseline ensured for 12 personas (0 healed from an unverified state)
✓ Reconciliation OK — 13 standing personas agree
seed exit code: 0
```
`0 healed` on the second run — the step is idempotent.

**End state on staging:** `test-free` → tick `false`, ts `null`, method `null` (all signals agree on **unverified**); `public.is_phone_verified(test-free)` → `false`, so the listing gate fires; invariant violations across **all** profiles → **0**.

---

## 3. Item 3 — Phone-gate dev autofill: first tap now works ✅ (two defects, both fixed)

### Defect A — the first tap was genuinely swallowed (root cause found)
`OTPInput` **auto-focuses** (`autoFocus` + a focus effect), so the number pad is always up on the code step — and `PhoneVerificationModal`'s `ScrollView` had **no `keyboardShouldPersistTaps`** prop. React Native defaults that to `'never'`, which means: **while the keyboard is up, the first tap anywhere in the scroll view is consumed to dismiss the keyboard and never reaches the child.** That is precisely QA's observation — *"code field stayed empty, Verify still disabled"* — i.e. the press handler never ran. It was not a stale accessibility tree.

**Fix:** `keyboardShouldPersistTaps="handled"` on the modal's `ScrollView`. This also removes a wasted first tap for real users on **Verify / Resend Code / Change Phone Number**.

### Defect B — the same button verified TWICE (would have got worse)
The autofill button both sets `code` **and** calls `handleVerifyCode()` directly, so the auto-verify effect re-fired for the same code → **two `verifyPhoneCode` calls → two `onSuccess()` → two published listings** (the F1 duplicate first reported by QA Task 43h). Fixing only Defect A would have made this hit on the *first* tap instead of the second.

**Fix:** a single-verify guard (`verifyInFlightRef`) in `handleVerifyCode`. `handleVerifyCode` runs synchronously from the press handler before React re-renders, so the effect's call is deterministically the one that returns early. Reset on failure, so the manual Verify button still works.

### On-device verification (iOS Simulator)
| Step | Result |
|---|---|
| Cold relaunch → `qa-login-as?persona=test-free` | landed on Home, free tier ("Unlock Swap Points") |
| create-item → photo → category (Books) → fill → Submit | **phone gate fired**: "Phone verification is required before you can publish listings or make purchases." with `+15551234004` **prefilled** from `profiles.phone` |
| Send Code | OTP step; **number pad up**; `DEV mode: use code 123456`; "Dev: Autofill & Verify (123456)" present |
| Tap the autofill button **ONCE** | ✅ **worked on the first tap** — modal closed, publish resumed, "Thanks for submitting!" |
| DB proof | `test_free_items_total = 8` (was 7 → **exactly +1**); new item `a06ba516…` at `13:50:52.419Z`; verify at `13:50:50.901Z` |
| Comparison | the earlier round's pair sit at `12:57:15.287` and `12:57:15.29` — a **3 ms** pair, the old duplicate signature |

### Regression test (proven to be non-vacuous)
New test: *"DEV autofill verifies exactly once — the auto-verify effect re-fire is absorbed"*. It holds `verifyPhoneCode` **pending** via a deferred promise, because with the immediate `mockResolvedValue` used elsewhere in the file the two triggers never overlap and the assertion passes **even with the guard removed** — i.e. it would have been a vacuous test (BP-88 / §9.1e). Verified both ways:
- guard **in place** → 15/15 pass
- guard **temporarily disabled** → fails with `Expected number of calls: 1, Received: 2`
- guard **restored** → green (and `grep TEMP-PROBE` confirms the probe was removed)

---

## 4. Item 4 — F4 fresh-mount control: **expected R96 behaviour, no bug** ✅

**Method:** after a successful publish, terminated the app → cold relaunched → opened `create-item` via deep link.

**Result — the form resets cleanly:**
- `Photos *` → **(0/10 photos)** (the previous session had 1)
- `Dev: Set Category` → **no "(Books)" suffix** — the retained category is gone
- **No publish/submit button at all** (photo-first gating renders only the Photos section with 0 photos)

Compare with the retained-screen state observed just before terminating (1/10 photos, "Set Category (Books)", enabled "Submit for Review").

**Verdict: F4 CLOSES AS EXPECTED BEHAVIOUR — no stale-form bug, no code change needed.** The earlier retention was purely R96: the deep link re-focused an **already-mounted** route, so the component state was never recreated. A genuine cold mount creates fresh state. (Note: `handlePublish` still never explicitly resets the form — which is correct, since a successful publish navigates away; the mount lifecycle is what guarantees a clean form.)

---

## 5. Regression summary

**Change classification:** A (DB migration/trigger/RPC) + C (mobile UI) + tooling. **Impacted flows:** FLOW-01 (auth/phone verification), FLOW-04 (listing creation gate), FLOW-02 (profiles).

| Tier | Scope | Result |
|---|---|---|
| **Tier 0** | `npm run typecheck` (covers `scripts/**` via `**/*.ts`) | **PASS** |
| **Tier 0** | `eslint` on the 3 changed `src/**` files | **PASS** (0 errors) |
| **Tier 0** | Targeted Jest — `PhoneVerificationModal`, `phoneService`, `EditProfileScreen` | **PASS** — 50/50 |
| **Tier 1** | On-device (iOS): gate fires → one-tap dev autofill → publish resumes → exactly one item | **PASS** |
| **Tier 1** | On-device (iOS): F4 cold-mount control | **PASS** — form resets cleanly |
| **Tier 2** | Migration dry-run on a real local Postgres 17.6.1 (backfill, trigger derivation, live RPC invoke, idempotency ×3) | **PASS** |
| **Tier 2** | Live staging verification of the applied migration (invariant 0, trigger enabled, grants, live invoke) | **PASS** |
| **Tier 2** | `seed:staging` reconciliation gate + read-back (run twice) | **PASS** |
| **Tier 2** | "DB rebuild from migrations" (`supabase db reset`) | **DEFERRED — pre-existing blocker** (see below) |

**Tier 2 note on `eslint scripts/**`:** the two changed `scripts/*.ts` files cannot be linted by the existing config (`tsconfig.eslint.json` does not include `scripts/**`). This is **pre-existing** — verified by linting an *untouched* `scripts/*.ts` file, which produces the identical parsing error. They **are** typechecked.

**Tier 2 blocked leg — needs an owner decision (Blocked-Tier Discipline):** `supabase db reset` cannot pass because 111 legacy-numbered migration files sort before the base schema (FIX-Task-35/38/40). This is unrelated to this change and carried forward repeatedly. The local dry-run above was my substitute for that leg, against a real Postgres 17.6.1 with a purpose-built stub. **Owner decision needed:** either schedule the migration-chain repair as its own task (FIX-Task-40's phase 2 is partially done) or explicitly accept that `db reset` is not a gate here.

**Rollback (stated before execution):** `DROP TRIGGER IF EXISTS trg_profiles_sync_phone_verified ON public.profiles;` — one line; the boolean simply stops being derived, and no data repair is needed to revert.

---

## 6. Pre-existing observations (not caused by this change)

- **`seed:staging` badge error:** `❌ Failed to create badge "Trade Master": violates check constraint "badges_category_check"`. The badges seeding code is untouched by this task. Pre-existing.
- **`verification.ts` is dead app code** (imported only by its own unit test) yet still contains the pre-V3 broken flow (inserts/queries the dropped `phone_verification_codes.verified` column and calls `verify_user_phone`). Candidate for deletion.
- The `qa-payfail-retry-fixture.mjs` / other fixture scripts each carry their own copy of the profile-upsert block; the phone-timestamp omission was the same one-line shape in all 7.

---

## 7. What changed (files)

**DB**
- `supabase/migrations/20260918000002_fix_task_58_phone_verified_source_of_truth.sql` *(new; written + applied)* — backfill, derivation trigger, column comment, repaired `verify_user_phone`, re-asserted grants.

**Mobile**
- `p2p-kids-marketplace/src/components/auth/PhoneVerificationModal.tsx` — `keyboardShouldPersistTaps="handled"` (first tap reaches the control) + single-verify guard (no duplicate publish).
- `p2p-kids-marketplace/src/components/auth/__tests__/PhoneVerificationModal.test.tsx` — new discriminating regression test (verified to fail without the guard).
- `p2p-kids-marketplace/src/screens/profile/EditProfileScreen.tsx` — reads `phone_verified_at` instead of the drift-prone boolean.

**Tooling**
- `p2p-kids-marketplace/scripts/seed-staging-data.ts` — writes `phone_verified_at` on create; new `seedPhoneVerificationBaseline()` (test-free reset + self-heal + fail-loud reconciliation).
- `scripts/provision-linked-provider-fixture.ts`, `scripts/qa/{payout-fixture,qa-payfail-fixture,qa-payfail-retry-fixture,r41-first-trade-free,r41-trial-fixture,wallet-persona-fixture}.mjs` — each now writes `phone_verified_at`.

---

## 8. Open questions / recommendations for the owner

1. **`auth.users.phone`** — accept it as the change-flow's record (recommended), or keep it in lockstep with verification? (See §1.)
2. **`verify_user_phone` authorization hole** — needs its own task (see §1). This is a real security gap.
3. **`supabase db reset`** — owner decision required; it is a permanently blocked Tier-2 leg (see §5).
