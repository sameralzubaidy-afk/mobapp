# FIX-Task-2 — Consolidated fixes from QA Task 43c (AUTH Android R2) — Report

**Date:** 2026-09-07 · **Scope:** 9 items (8 from the 43c handoff + ResetPassword scroll-oscillation per owner note). **Change classifier:** UI/screens + services (shared components) + staging data/config + schema index. **Regression tiers:** Tier 0 (PASS — see §4); Tier 1/2 on-device verification → QA follow-up (see §5/§6).

---

## 1. What shipped (code) — all Tier-0 green

| Item | File | Change | Why |
|---|---|---|---|
| 1 (code) | `p2p-kids-marketplace/src/services/location.ts` (`checkZipCodeHasActiveNode`, ~L192) | Replaced `.maybeSingle()` (PGRST116 on 2+ rows → false) with `.limit(1)` + array length check | 43c Finding #1 — an ACTIVE home ZIP with >1 active node wrongly showed the "not live here yet" waitlist ask in Discover |
| 1 (test) | `src/__tests__/services/location.test.ts` | Updated mocks to the `.limit(1)` array contract + added a 2-active-rows → true regression test | prove the multi-node ZIP no longer false-negatives |
| 2 | `src/providers/GlobalAlertProvider.tsx` (`buttonCancel`/`buttonTextCancel`) | Cancel/escape buttons now Secondary Outline: `2px solid colors.primary[500]` + green text on white (was gray 1px `neutral[700]`) | 43c Finding #2 (owner-reported) — design-doc `design-system-passitup.md` §4.2/§7; gray outline read as co-primary |
| 2 (test) | `src/providers/__tests__/GlobalAlertProvider.test.tsx` | Realigned the A06 mock to real `SignupScreen` semantics (Fix it=primary, Continue anyway=cancel) + added a Secondary-Outline style assertion | keep the test honest + assert the new green-outline escape |
| 3 (code) | `src/services/devTestingService.ts` (`getSimulatedForgotPasswordError`) | Added `'bad_email'` → `{ message:'Email address is invalid', status: 400 }` (unblocks S05) + doc updates | S05's 400 branch is not otherwise inducible (GoTrue returns 200 for unknown emails) |
| 4 | `src/types/auth-v3-errors.ts` + `src/services/oauthService.ts` + `src/components/auth/SocialLoginButtons.tsx` | New `ProviderDisabledError`; classified provider-not-enabled / 400 validation_failed at OAuth initiation; friendly in-app banner copy ("…Sign-In is temporarily unavailable. Please use email or another method instead.") | 43c C03 UX — never leave a real user on the raw `400 provider is not enabled` JSON page |
| 4 (test) | `src/services/__tests__/oauthService.test.ts` | Added ProviderDisabled classification test | |
| 5 | `src/screens/auth/PhoneVerificationScreen.tsx` (Verify button ~L215) | `disabled={loading \|\| code.length === 0}` (was `…!== 6`) so tapping Verify with 1–5 digits hits the existing "Please enter all 6 digits" guard | align app→guide (AUTH-TC-E02 step 1: "Tap Verify with fewer than 6 digits"); the guard was previously unreachable dead code |
| 6 | `src/components/molecules/SearchFilterModal.tsx` + `src/screens/home/DiscoverScreen.tsx` | New `countScopeNodeIds` prop; the modal's live "Show N Results" now passes the grid's node scope to `countListings` while the sheet's location is unchanged (falls back to a global preview when a NEW zip is typed in-sheet) | 43c UX note — base count (1154) disagreed with the node-scoped grid (81) for Show-All-Nodes-OFF users |
| 6 (test) | `src/__tests__/components/SearchFilterModal.test.tsx` | Added scoped-count + global-preview tests | |

**Deferred with rationale (no risky blind code):**
- **Phase A′ (ResetPassword ScrollView oscillation)** — needs an on-device reproduce/iterate loop; a blind KeyboardAvoidingView/ScrollView restructure risks S07/S10 correctness (the plan's own verify-first gate + the guard-rail "don't loosen empty-field disabled"). Characterized source-side: `ResetPasswordScreen.tsx` ScrollView L274 in a KAV; inline-error height shifts ~52px; ~±327px oscillation measured by QA.
- **Item 7 (DOB TAB-key leak)** — root cause is cross-field hardware-keyboard focus traversal at the RN/native level, not fixable safely inside `DateOfBirthPicker` (auto-advancing a full field on focus would break tap-to-edit of a completed DOB). QA playbook already codifies never-TAB + dev-fill (R77 #11). A global Android TAB-interception is a separate exploration needing device verification.
- **Item 4 on-device confirmation** — the ProviderDisabled classification fires when supabase-js surfaces the error at initiation. Whether the disabled-Apple case currently opens the tab (raw JSON) vs rejects at initiation must be confirmed on-device (iOS + Android) during the QA re-drive.
- **C07 (attach real Google identity)** — see §2.

## 2. SQL executed against staging (Supabase MCP — user-approved), all verified live

| Action | Statement | Result |
|---|---|---|
| Item 8 — zip_waitlist cleanup | `DELETE FROM public.zip_waitlist WHERE id = '1ab95322-cc99-40ea-8dc6-bf419a08ca6f' AND requested_zip='99999'` | 0 rows remain for 99999 (O03 baseline restored) |
| Item 3 — arm `qa_provider_unavailable` | `upsert_admin_config_setting(..., 'all', 'feature_flags', 'string', false, true, <samer admin id>)` | value=`all`, updated_by=1a546991-… (editor recorded) |
| Item 3 — arm `qa_avatar_upload_failure` | same RPC → `'upload_failure'` | value=`upload_failure` |
| Item 3 — arm `qa_reset_error_simulation` | same RPC → `'rate_limited'` | value=`rate_limited` (S03 first; re-arm `smtp_500`→S04, `bad_email`→S05 between cases) |
| Item 1 — data cleanup | `UPDATE profiles SET node_id=Norwalk(550e8400-…-0001) WHERE node_id=Diag(6bf728cf-…)` → `UPDATE nodes SET is_active=false WHERE id=6bf728cf-…` | Diag members 4→0; Norwalk 172; 06850 active = 1 (Norwalk); **no duplicate active zips remain** |
| Item 1 — schema guard | `CREATE UNIQUE INDEX idx_nodes_unique_active_zip ON public.nodes(zip_code) WHERE is_active = true` (migration `supabase/migrations/20260907000001_fix_unique_active_node_zip.sql`) | index live (verified `pg_indexes`) |

Durable artifact: `cleanup-duplicate-active-node-06850.sql` (repo-root convention) records what ran + rollback snippet + verification.

**QA-impact note (Item 1):** impact assessment ran before any write — only 4 profiles were on Diag (qa-payout-seller, qa-wallet + 2 disposables); historical child-row tags (items/trades/payments/sp_ledger/analytics/audit) were intentionally **not** re-tagged (provenance). Diag was **deactivated, not deleted**. Tracker note needed: admin cases that used Diag as an active-node subject (E03/E07/N6-FG-1) must use another active node or re-derive. Re-homing to Norwalk is a RESTORE of the pre-diag baseline.

**C07 finding (deferred — NOT executed):** the only real Google identities on staging are `kidsp2p@gmail.com` (linked to user `27699457-…`) and `samer.alzubaidi82@gmail.com` (linked to the owner's account `db71e4d8-…`). **Moving either would detach a live account's Google login** — exactly the kind of break to avoid. Attaching a synthetic identity won't help QA sign in (real OAuth returns the real Google account). → Defer C07 to ticket #19; operator SQL template (INSERT `auth.identities` … provider='google', ON CONFLICT DO NOTHING) is ready when a dedicated Google test account is available. The `SetPasswordModal`/`can_set_password` wiring already exists.

**Disarm reminder (post-43d, dev team):** the three toggles are armed for 43d. After 43d completes, disarm so staging stops simulating outages: set each back to `'none'` (or `is_active=false`) via the same RPC — `qa_provider_unavailable`, `qa_avatar_upload_failure`, `qa_reset_error_simulation`.

## 3. Requirements confirmed (source)
43c report Finding #1/#2 + handoff §8.3 items 1–7 + §6 app-state cleanup; `docx/design-system-passitup.md` §4.2/§7 (Secondary Outline / max-1-primary); AUTH guide E02 (OTP incomplete-code alert), S05 (400 branch), C05 (outage banner), C07 (social-only password); S07 (Reset disabled-while-empty — guard rail).

## 4. Regression — Tier 0: PASS
- `npx tsc -p tsconfig.json --noEmit` → exit 0 (multiple runs after each edit batch).
- `npx eslint <all edited files>` → 0 errors (only pre-existing `no-console` / exhaustive-deps warnings in files already carrying them).
- Jest suites (all PASS): location.test (multi-row regression) · GlobalAlertProvider.test (Secondary Outline) · oauthService.test (ProviderDisabled) · SearchFilterModal.test + DiscoverScreen.test (node-scope count) · nodeScope · discovery · PhoneVerificationModal · SocialLoginButtons · SignupScreen (A06 dialog semantics).
- **p2p-kids-admin untouched** — no admin code changed.

## 5. Verification pending (QA agent / on-device) — REQUIRED next
Per FIX-Task-1 precedent, shared-component/app-behavior changes need iOS + Android evidence. Not captured in this coding session (no simulator run):
1. **Item 1** — re-drive AUTH-TC-O02/O03 iOS+Android as test-buyer: applying ZIP 06850 in Discover Filters must NOT show the waitlist dialog (now 1 active 06850 node + tolerant lookup).
2. **Item 2** — re-drive AUTH-TC-A06: "Continue anyway" now green 2px outline; spot-check ≥2 other cancel dialogs (Remove-favorite, Settings Sign Out) on iOS+Android; before/after screenshots.
3. **Item 4** — tap Apple (still disabled) on iOS+Android → confirm friendly banner vs raw JSON (validate the initiation-surface assumption).
4. **Item 5** — re-drive AUTH-TC-E02: Verify tappable with <6 digits → "Please enter all 6 digits" (input not cleared).
5. **Item 6** — Discover Filters base "Show N Results" matches node-scoped grid on iOS+Android.
6. **Item 3** — C05/H03 (armed), S03/S04/S05 (sequential re-arm) now drivable.
7. **Phase A′** — dedicated on-device repro/iteration for the ResetPassword oscillation (not shipped blind).

Evidence folder naming (when captured): `fix-task2-{ios|android}-{before|after}-{state}.png` per FIX-Task-1.

## 6. Known gaps / not done
- Phase A′ + Item 7: deferred (rationale in §1) — need on-device loop.
- C07: deferred to ticket #19 (identity collision — see §2).
- Item 4 on-device confirmation; full cross-platform screenshot evidence (QA).
- Full `npm test` run not executed (only affected + related suites); full `tsc`/`eslint` pass.

## 7. Files changed
`location.ts` · `location.test.ts` · `GlobalAlertProvider.tsx` · `GlobalAlertProvider.test.tsx` · `devTestingService.ts` · `auth-v3-errors.ts` · `oauthService.ts` · `SocialLoginButtons.tsx` · `oauthService.test.ts` · `PhoneVerificationScreen.tsx` · `SearchFilterModal.tsx` · `SearchFilterModal.test.tsx` · `DiscoverScreen.tsx` · migration `supabase/migrations/20260907000001_fix_unique_active_node_zip.sql` · artifact `cleanup-duplicate-active-node-06850.sql`. Staging state: toggles armed, Diag deactivated, 4 members re-homed to Norwalk, zip_waitlist 99999 row deleted, unique-active-zip index live.
