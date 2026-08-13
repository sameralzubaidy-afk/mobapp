# QA Report — iOS Stage 4: Supervised Write-Based Test-Data Provisioning

- **Date:** 2026-08-12
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1
- **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`) — Expo dev-client, **staging**
- **Supabase project:** `drntwgporzabmxdqykrp` (`https://drntwgporzabmxdqykrp.supabase.co`) — confirmed before first query
- **Repo HEAD:** `885358ac` (clean working tree; `git status --short` empty)
- **Scope:** 3 scenarios (0, 1, 2); first stage with write access — every write preceded by an explicit per-call confirmation and logged for rollback

---

## 1. Results Matrix

| Scenario | Description | Status | Key evidence |
|---|---|---|---|
| **0** | Session-residue check (teardown mid-onboarding → second account in same session) | **PASS** | Account 2 signed in as Charlie Smith ("CS", Greenwich); backend wrote only account 2's row; account 1's row untouched |
| **1** | Create known-state test account via direct write to `public.profiles` (no Auth identity) | **PASS (decisive finding)** | INSERT rejected by FK `profiles_user_id_fkey → auth.users(id)` — a `profiles`-only, no-auth row **cannot be created at all** |
| **2** | Targeted UPDATE to a real app-created account to set a specific state | **PASS** | Direct `onboarding_completed_at` write → fresh login routed straight to Home, skipping onboarding carousel |

---

## 2. Session-Residue Check Result (Scenario 0) — **PASS**

**Procedure:** Created account 1 (`stage4.s0.acc1.1786533400@example.com`, "Bob Demo") via dev-autofill + unique email, completed phone verification (DEV bypass), and stopped at **Complete Your Profile** (onboarding NOT completed). Triggered the QA logout deep link from that onboarding state → app returned to **Landing** (deep-link logout re-confirmed from the onboarding stack). Immediately created account 2 (`stage4.s0.acc2.1786533400@example.com`, "Charlie Smith") via dev-autofill + unique email, completed phone verification (confirming the OTP screen showed **Charlie's phone `+12025559999`**, not Bob's), completed profile setup + onboarding, and reached Home.

**Identity verification:**
- **UI:** Home header showed **"CS"** (Charlie Smith's initials) and location **Greenwich**; My Profile screen displayed **"Charlie Smith"** — not "Bob Demo".
- **Backend (read-only):** Account 2's row showed `profile_completed=true`, `node_id=<Greenwich>`, `zip_code=06830`, `phone_verified=true`, `updated_at` at setup time. Account 1's row was completely untouched (`profile_completed=false`, `node_id=null`, unchanged `updated_at`).

**Conclusion:** **PASS — no cross-contamination.** Tearing down account 1 mid-onboarding leaves no lingering client session state; account 2's session reflects account 2 cleanly in the same app session.

---

## 3. Direct-Write Viability Findings (Scenario 1)

**Planned action:** Minimal INSERT into `public.profiles` (`user_id`, `name`, `email` = `stage4.directwrite.1786534989@example.com`), deliberately with no corresponding `auth.users` identity, to test whether a `profiles`-only row is functionally usable.

**Result — the write was rejected by the database:**

```
ERROR 23503: insert or update on table "profiles" violates foreign key
constraint "profiles_user_id_fkey"
Key (user_id)=(…) is not present in table "users".
```

Schema inspection (read-only) confirmed:
- `profiles_user_id_fkey`: **`FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`** — **validated** (`convalidated=true`).
- `profiles.user_id` is NOT-NULL with no default.

**What happened when attempting to log in:** N/A — the row cannot exist, so there was nothing to log into. This is stronger than the prompt's anticipated outcome ("may not be loggable-into"): the database **refuses to create** a `profiles` row without a real Auth identity.

**Conclusion:** **Direct-write provisioning to `profiles` ALONE is NOT viable.** It is impossible to create a no-auth profile row because of the validated FK to `auth.users(id)`. Any direct write must reference an existing Auth identity, so direct-write provisioning must always be **paired with a real signup flow** (or a documented Auth admin helper, which is outside this stage's allowlist). A direct write is therefore only useful for **modifying existing real accounts** (as Scenario 2 demonstrates) or seeding rows for already-existing identities — never for creating standalone test users.

*Compliance note:* Per safety rule 2, I did **not** work around this by writing to `auth.users` or `public.users` (both outside the allowlist); the specific need is reported here instead. The failed INSERT was atomic (no row created — verified by read-back), so there was nothing to clean up.

---

## 4. Targeted State-Update Findings (Scenario 2)

**Procedure:** Created account 3 (`stage4.s2.acc1.1786534989@example.com`, "Bob Demo") via dev-autofill + unique email, completed phone verification, and stopped at Complete Your Profile. Executed a direct `UPDATE` on its `profiles` row setting **`onboarding_completed_at = now()`** (chosen as the single low-risk, reversible, onboarding-state field — the app's `shouldShowOnboarding` gate reads `onboarding_completed_at`/`onboarding_skipped_at`, so this is the flag that actually drives login routing to Home vs. the carousel).

**Verification:**
1. **While sitting on Complete Your Profile (client already mounted):** the screen did **not** live-refresh — expected client-side state behavior; the mounted screen does not react to a server-side write it didn't trigger.
2. **On fresh login:** after the deep-link logout and a login with this account, the app routed **directly to Home** (header "BD" for Bob Demo, tab bar present, **no onboarding carousel**, "No active trades"). The direct DB change was fully reflected at login-time routing.

**Conclusion:** Direct state manipulation for an already-real account **is a reliable way to set up specific test conditions** (e.g., "an account that has completed onboarding") without slow manual UI steps. The app correctly respects the server-side flag on login. Caveat: the account landed at Home **without a node assigned** ("Local Market" header) because profile setup was never completed — an expected artifact of a targeted single-field write, and itself a useful example of producing a precise edge state.

---

## 5. Safety Compliance Check

- **Staging identity confirmed before the first query:** project URL resolved to `https://drntwgporzabmxdqykrp.supabase.co`; app `.env` confirms `EXPO_PUBLIC_ENVIRONMENT=staging` and the same URL. Every MCP call used `project_id = drntwgporzabmxdqykrp`.
- **Every write stayed within the allowlist:** all successful writes were `UPDATE public.profiles` on rows/accounts created **this session** (3 soft-deletes + 1 targeted state update). The one attempted `INSERT` was rejected by the FK and is a documented no-op — no table outside the allowlist was written to.
- **Every write was preceded by an explicit per-call confirmation:** each write stated table, operation, exact filter/values, and rollback action immediately before execution (Writes #1–#5).
- **No table outside the allowlist was touched, including for reads beyond scenario need:** reads were scoped to `public.profiles` (specific known emails), `public.nodes` (to pick an active zip for onboarding), `public.users`/`pg_constraint`/`information_schema` (schema/constraint inspection needed to diagnose the Scenario 1 FK), and `auth.users` was **never** written (only FK-inspected via constraint metadata). No money/points/fee/wallet/transaction/order tables, no audit/log tables, no schema/migration operations.
- **Stray accounts from prior stages** (`rewardsfirsttradebobauto.demo@example.com`, `alice.stage3.0811@example.com`, `qa.otp.verify.1786479747@example.com`, `bob.stage3.1786481365@example.com`, `bob.stage3.dl.fix.1786484977@example.com`) were **noted but not acted on** — their cleanup is outside this stage's automated allowlist.

---

## 6. Test Data / Rollback Log

| # | Table | Identifying key | Operation | Values / state | Cleaned up? |
|---|---|---|---|---|---|
| — | `public.profiles` | `stage4.s0.acc1.1786533400@example.com` (Bob Demo, id `c5822bc1…`) | **UI-created** account (Scenario 0, via app signup) | profile_completed=false, onboarding_completed=false | ✅ Soft-deleted (Write #1) |
| 1 | `public.profiles` | `stage4.s0.acc1.1786533400@example.com` | UPDATE (soft-delete) | `deleted_at=now()`, `deletion_type='admin'` | ✅ Done — rollback: set `deleted_at=NULL` |
| — | `public.profiles` | `stage4.s0.acc2.1786533400@example.com` (Charlie Smith, id `69b2c3bc…`) | **UI-created** account (Scenario 0) | profile_completed=true, node=Greenwich | ✅ Soft-deleted (Write #2) |
| 2 | `public.profiles` | `stage4.s0.acc2.1786533400@example.com` | UPDATE (soft-delete) | `deleted_at=now()`, `deletion_type='admin'` | ✅ Done — rollback: set `deleted_at=NULL` |
| 3 | `public.profiles` | `stage4.directwrite.1786534989@example.com` | INSERT (Scenario 1) | **REJECTED** by FK `profiles_user_id_fkey → auth.users(id)` — no row created (verified) | ✅ N/A — nothing created; nothing to clean up |
| 4 | `public.profiles` | `stage4.s2.acc1.1786534989@example.com` (Bob Demo, id `b1f51816…`) | UPDATE (Scenario 2) | `onboarding_completed_at=now()` | ✅ Reverted implicitly by Write #5 (row soft-deleted); explicit rollback: `onboarding_completed_at=NULL` |
| 5 | `public.profiles` | `stage4.s2.acc1.1786534989@example.com` | UPDATE (soft-delete) | `deleted_at=now()`, `deletion_type='admin'` | ✅ Done — rollback: set `deleted_at=NULL` |

**Final read-back confirmed:** all 3 profiles created this session carry `deleted_at` (soft-deleted) with `deletion_type='admin'`; the direct-write email has no row. **Every row created this session has been cleaned up.**

**What remains (by design / documented limitation):**
- The **`auth.users` identities** for the 3 app-created accounts (Scenario 0 ×2, Scenario 2 ×1) remain as orphaned identities (their profiles are soft-deleted). `auth.users` writes are outside this stage's allowlist, so full account teardown is not yet possible — these emails are now effectively non-reusable via signup. Future stages should add a **documented, explicitly-authorized Auth teardown helper** (or an admin RPC) to complete the delete cycle.
- Pre-existing stray accounts from prior stages (listed in §5) remain untouched, as required.

---

## 7. Readiness for Broader Write-Based Provisioning

**Overall: YES with guardrails.** Direct Supabase write access proved reliable and safe for the narrow, confirmed, logged use cases exercised here (soft-delete cleanup + single-field state updates on session-created accounts). The mechanics of every write were verified by read-back, and the app demonstrably honors direct profile writes at login-time routing.

**Guardrails that should remain mandatory:**
1. **Staging-only confirmation before every session** (URL + `.env` double-check) — non-negotiable.
2. **Per-call confirmation gate with stated rollback** for every write — keep.
3. **`auth.users` stays read-only/untouched** — the FK reality means profiles writes are implicitly safe (they require a real auth id), which is itself a useful invariant.
4. **Scoped reads only** — avoid unscoped SELECTs; this held up well.
5. **Soft-delete (`deleted_at`, `deletion_type='admin'`) as the cleanup primitive** — matches the app's own deletion model and avoids FK/dependency issues from hard deletes. Codify this as the standard cleanup action.

**What could reasonably be relaxed/added next stage:**
- **A documented, explicitly-authorized Auth teardown path** (admin RPC or service-role helper) so accounts created via UI can be fully removed (profile + auth identity), eliminating orphaned identities. This is the single biggest blocker to "clean slate" bulk workflows.
- **Bulk-seeding multiple known-state accounts** is feasible *once* provisioning is paired with real auth identities (e.g., a batch signup RPC that creates auth + profile + wallet + free subscription in one transaction, mirroring `handle_new_user`). Direct `profiles`-only INSERT is a dead end (FK), so future bulk provisioning should go through a documented helper, not raw inserts.
- After the auth-teardown gap is closed, this stage's approach is sufficient to seed/cleanup a larger regression pass.

**Noted for a future stage (not acted on):**
- The redesigned signup screen's custom `TextInput` does **not** expose field values in the accessibility tree until a field is edited; dev-autofill buttons and the Create Account button sit **below the 956px fold** and require scrolling before they are tappable — this is the dominant UI-driver friction on this screen (see Session Notes).
- The signup/login screens shift vertically when the software keyboard appears, so coordinate taps must be re-derived after every keyboard-state change (Stage 2 pitfall, reproduced here on the login screen).

---

## Session Notes (for future stages)

- **Keyboard dismissal:** tapping empty ScrollView space (default `keyboardShouldPersistTaps="never"`) dismisses the keyboard reliably on ProfileSetup; on signup, tapping the "or" divider worked. `Cmd+K` via osascript was unreliable (toggled unpredictably).
- **Field select-all:** `Cmd+A` (osascript) into a focused field reliably selects all; double-tap does NOT reliably select all on the redesigned signup inputs. Typing after Cmd+A replaces cleanly.
- **Signup flow recipe that worked:** scroll down → tap dev-autofill → scroll up → tap email field → Cmd+A → type unique email → dismiss keyboard → scroll down → Create Account → (verify via Supabase read-back that the exact email registered).
- **Scrolling:** small swipes (300px) on the signup ScrollView reliably scroll; the tree reports screen coordinates (buttons only tappable when y < 956).
