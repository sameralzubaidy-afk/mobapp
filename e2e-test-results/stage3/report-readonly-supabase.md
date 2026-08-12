# iOS Stage 3 — Read-Only Supabase Staging Awareness — QA Report

- **Date:** 2026-08-11 (local ~17:07–17:16)
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), iOS 26.1
- **App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`) — Expo dev-client build, pointed at **staging**
- **Staging project (verified before first query):** `drntwgporzabmxdqykrp` (`https://drntwgporzabmxdqykrp.supabase.co`)
- **Test-buyer:** `rewardsfirsttradebob.demo@example.com` / `DemoPass456`
- **New account created (Scenario 1):** `bob.stage3.1786481365@example.com`
- **Git state:** clean on `main`; gap-closure commits present (`a870e295`, `e64164e2`, `b2e9e262`)

---

## 1. Results Matrix

| Scenario | Description | Status | Evidence | Key finding |
|---|---|---|---|---|
| S1 | New signup creates expected user record | **PASS** | `TC-S1_step*` screenshots; DB reads #3/#4/#5 | Record exists and matches UI data exactly. Legacy `phone_verified` boolean is `false` while `phone_verified_at` is set (see §5). |
| S2 | Login failure does NOT create/modify any record | **PASS** | `TC-S2_step1_login-failed.png`; DB reads #6/#7/#8/#9 | Failed login left profile untouched (`updated_at` predates attempt), no audit/session rows, no lockout flag. |
| S3 | Logout via deep link reflects in session state | **PASS** (UI) / **SKIPPED** (DB check) | `TC-S3_step1/step2` screenshots; DB read #10 | Deep link logout from Home worked → Landing. No observable server-side session record (`auth_sessions` table empty). |

---

## 2. Database Cross-Reference Findings

### Scenario 1 — New signup (`bob.stage3.1786481365@example.com`)
Queried **`public.profiles`** filtered by the exact email entered in the UI. Fields checked: `id`, `user_id`, `name`, `email`, `phone`, `dob`, `phone_verified`, `phone_verified_at`, `phone_verification_method`, `profile_completed`, `created_at`.

| Field | UI expectation | DB value | Match |
|---|---|---|---|
| `name` | "Bob Demo" (autofill) | `Bob Demo` | ✅ |
| `email` | `bob.stage3.1786481365@example.com` | exact match | ✅ |
| `phone` | `+12025555678` (autofill) | `+12025555678` | ✅ |
| `dob` | `2001-06-20` (autofill) | `2001-06-20` | ✅ |
| `phone_verified_at` | set after OTP success | `2026-08-11 21:07:28.641+00` | ✅ |
| `phone_verification_method` | sms | `sms` | ✅ |
| `phone_verified` | true (UI success shown) | **`false`** | ⚠️ see §5 |
| `profile_completed` | false (stopped at onboarding) | `false` | ✅ |

Also verified the Supabase Auth identity in **`auth.auth.users`** (same email; `id` = `586fb634-…` matches `profiles.user_id`; `email_confirmed_at` set). The new user does **not** appear in the separate `public.users` table (3 rows — separate/unused table), so `profiles` is the canonical app user store.

**Verdict:** UI-reported success is backed by a matching record. No misleading state.

### Scenario 2 — Login failure (wrong password for test-buyer)
Queried **`public.profiles`** filtered by `rewardsfirsttradebob.demo@example.com`. Fields: `account_status`, `updated_at`, `phone_verified`, `profile_completed`, `created_at`.

- `account_status` = `active` (no lockout/suspension) ✅
- `updated_at` = `2026-08-09 17:32:52 UTC` — predates the failed attempt (2026-08-11 ~21:14 UTC) → the profile row was **not** touched ✅
- No app-level login-attempt/lockout counter exists in the public schema to inspect.
- Checked **`public.admin_audit_logs`** (by `actor_id`, last 1 hour): **no rows** → no audit entry created.
- Checked **`public.auth_sessions`** (by `user_id`): **no rows** → no session row created.

**Verdict:** No unintended state change from a failed login. Nothing concerning.

### Scenario 3 — Logout via deep link
- Queried **`public.auth_sessions`** (count): **0 rows** — the app's only candidate server-side session table is empty/unused. Supabase Auth sessions are client-side JWTs (auth schema), not observable here.
- **SKIPPED** — no observable server-side session record for this auth configuration (as the stage anticipated).

---

## 3. Safety Compliance Check

- **Read-only confirmed:** No `insert`/`update`/`delete`/`alter`/`migrate` tool was called at any point. All `mcp_supabase_*` calls were: `get_project_url` (identity), `list_tables` (schema inspection), and `execute_sql` with **SELECT-only** statements. One SELECT failed on a non-existent column (`admin_audit_logs.action`) — an error, not a mutation; corrected and re-run.
- **Staging verified before first query:** `get_project_url` for `drntwgporzabmxdqykrp` returned `https://drntwgporzabmxdqykrp.supabase.co`, exactly matching the staging URL in `p2p-kids-marketplace/.env.local`. ✅
- **No broad scans:** Every query filtered by a specific known email or `user_id` (or a count on an empty table). No `SELECT *` on full tables; no enumeration of other users.
- **No PII beyond test accounts:** Reported only the known test account's name/email/dob and a test-format phone (`+12025555678`). No payment/private data printed.
- **UI remained the primary interface:** All signup/login/OTP/logout steps were driven through the UI; the DB was used only to verify results after the fact.

---

## 4. Data-Corruption Check

- **Database:** No wrong-element tap corrupted any database record. The submitted Scenario 1 record is clean and matches intent (verified via DB).
- **UI form fields (QA-driver hazard, not app bug):** During Scenario 1 email editing, the field was corrupted **twice** (text appended instead of replaced): once because three separate taps did not register as an iOS triple-tap, and once because a tap aimed at "Create Account" landed on the on-screen keyboard's `g` key (keyboard top extended higher than the tree's button coordinates). Both were **detected immediately** via the tree `value` attribute / OCR and corrected (Cmd+A select-all + retype) before submission.
- **Root cause of initial autofill "failure":** the dev-autofill buttons were listed at y≈1091 (below the visible viewport); the accessibility tree reports off-screen ScrollView children. Tapping their reported coordinates hit nothing. Scrolling to bring them on-screen (y≈662) made the autofill work. **This is a QA-driver coordination lesson, not an app defect.**

---

## 5. New Findings

1. **`phone_verified` boolean is `false` after successful OTP verification (minor inconsistency).**
   - The OTP flow (`verifyPhoneCode` in `src/services/phoneService.ts`) writes only `phone_verified_at` + `phone_verification_method`, not `phone_verified = true`. Code comments and the app's own gate treat `phone_verified_at` as canonical ("legacy uses phone_verified, newer schemas may rely on phone_verified_at"). So current behavior is internally consistent — but any consumer that reads the `phone_verified` boolean (e.g. `AuthContext` populates it) will see `false` right after a verified signup. Recommend confirming no feature gate depends on the boolean; if none does, either start writing it or deprecate it.
2. **QA logout deep link does not fire from the onboarding stack (Complete Your Profile).**
   - The `p2pkidsmarketplace://qa-logout` deep link worked from **Home** (returned to Landing) but produced no handler log and no navigation when sent in the foreground from Complete Your Profile. Cold-starting via the scheme opens the **Expo dev-client launcher** (custom-scheme URLs are intercepted by the dev client at cold start), not the app JS — the app only logged out after reconnecting to the bundle. The prior stage report (`report.md`) corroborates the deep link is verified from Home (4/4) and was never exercised from the onboarding stack. Recommend: (a) verify whether the onboarding stack can receive Linking events at all, or (b) document that QA teardown after a fresh signup must first complete onboarding to Home.
3. **`[phoneService] send-phone-otp invoke error: Fu...`** (truncated) appeared in the dev console overlay during the signup flow, yet the DEV OTP bypass still verified successfully. Worth checking the `send-phone-otp` Edge Function invocation path — possibly a non-fatal error on the real SMS path that the bypass masks.
4. **Dev-autofill buttons below the fold:** the tree lists them at off-screen coordinates; QA drivers must scroll first. (QA-driver note, carried forward.)

---

## 6. Test Data Left Behind

**New staging account created in Scenario 1:**
- `bob.stage3.1786481365@example.com` / `DemoPass456` — profile "Bob Demo", `+12025555678`, DOB `2001-06-20`, phone verified (`phone_verified_at` set), onboarding NOT completed (stopped at Complete Your Profile).

**Still-open cleanup items from gap-closure (unchanged):**
- `rewardsfirsttradebobauto.demo@example.com`
- `alice.stage3.0811@example.com`
- `qa.otp.verify.1786479747@example.com`

---

## 7. Readiness for Stage 4

**Verdict:** Read-only Supabase access works **reliably enough** to proceed to Stage 4 (supervised write-based test-data provisioning). Across 3 scenarios the read path (identity confirmation → schema inspection → targeted SELECT by known key) returned consistent, correct results, and every UI↔DB cross-reference matched or produced a clear, explainable discrepancy.

**For Stage 4 to be safe, the following should be true:**
1. Writes stay **scoped to known test records** (the Stage-4 prompt must enumerate exact inserts/updates, tables, and values, and forbid anything touching `auth.users`, real-user rows, or money/points tables).
2. A per-call confirmation gate remains (state the exact DML before executing), and the connection is still verified against `drntwgporzabmxdqykrp` staging before the first write.
3. A rollback/cleanup list is maintained (Stage 4 must log every row created so teardown is possible).
4. The two §5 findings (legacy `phone_verified`, deep-link-on-onboarding) are acknowledged but do **not** block Stage 4 — they are read-side observations, not write-safety issues.
