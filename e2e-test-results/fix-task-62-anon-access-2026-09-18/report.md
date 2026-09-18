# FIX-Task-62 — Anonymous-access lockdown (admin reads + profiles + rename RPC)

**Date:** 2026-09-18
**Author:** Kids P2P App Builder session
**Scope of this dispatch:** combined workstream — Part 1 FIX-Task-61 confirmation/evidence, Part 2 FIX-Task-62 (this report's primary subject), Part 3 FIX-Task-60 staging apply.

> ## ⚠️ Two warnings up front
>
> **1. A different workstream also uses the name "FIX-Task-62".**
> A parallel session is writing **payout** migrations (`rpc_release_due_payouts` requeue / D2 gate) under the same task label, and its report already lives at
> `e2e-test-results/fix-task-62-2026-09-18/report.md` — **this report deliberately does not touch that directory.**
> Its three files originally used the **same number prefixes** as this task's two migrations. Both of this task's files were therefore moved to a reserved block (`20260918050000`, `20260918050001`); `ls *.sql | cut -d_ -f1 | sort | uniq -d` is now empty. See Part 3 for the coordination consequences.
>
> **2. Part 3 (staging apply) is PAUSED by owner decision.**
> Owner chose **Option A**: "Pause Part 3; finish Parts 1–2 + the combined report now." Nothing in this report was applied to staging. Every DB statement below was verified on a **local rebuilt database** (`replay-probe.mjs`, 543/543 files, `deferred 0`, `unresolved 0`).

---

## 1 · Part 2 — the three holes, as found

| # | Hole | Evidence (live ACL read, FIX-Task-59 audit) |
|---|---|---|
| 1 | `admin_get_user_detail(uuid,uuid)` — full-PII read, **callable by `anon`** | `has_function_privilege('anon', …) = TRUE`; **no GRANT or REVOKE anywhere in the chain**, so it carried Postgres' built-in PUBLIC EXECUTE |
| 2 | Anonymous `SELECT`/`INSERT`/`UPDATE` on `profiles` and `items` | 13 `*_anon_*` policies still live on staging (the chain drops 12 of them in `20260916000158`; `items_anon_select` has no creator *or* dropper in the chain at all) |
| 3 | `setup_user_profile(uuid,text,text)` — anonymous "rename anyone" | SECURITY DEFINER with **no identity check at all**, `GRANT … TO anon, authenticated` (`20260916000093:905`) |

Two further defects were found while working the same surfaces (all disclosed, none silent):

- **`admin_list_users` and `admin_get_user_analytics` carry the identical defect and are the same class** — same file, same trust-the-parameter gate, same absent grant. Owner approved fixing the whole sibling class. `admin_list_users` has **two live overloads** (a 7-parameter one and the 9-parameter one the admin portal actually calls, from `20260703000002`); both were gated.
- **`admin_suspend_user` / `admin_unsuspend_user` / `admin_delete_user` carry the same weak predicate but are already locked to `service_role`** by `20260916000136_dev_task_59_grant_lockdown.sql:168-175`, so they are not anonymously reachable and were **left untouched**.

### The new predicate

The old gate trusted a caller-supplied id, so it only ever proved that *some* admin exists:

```sql
WHERE rbac.user_id = p_admin_id AND rbac.role = 'admin'
```

Replaced with an identity-derived form (same shape as `upsert_admin_config_setting`, DT-59):

```sql
WHERE rbac.role = 'admin'
  AND (rbac.user_id = auth.uid()
       OR COALESCE(current_setting('role', true), '') = 'service_role')
```

- `auth.uid()` is the real caller and takes precedence → `p_admin_id` can no longer be used to impersonate an admin.
- `current_setting('role')` — not `request.jwt.claim.role`, which this PostgREST never sets (BP-78) → service_role paths (admin API routes, seeds, E2E harnesses) keep working.
- `anon` fails closed. Message text `'User % is not an admin'` is preserved because `p2p-kids-admin/src/__tests__/integration/admin-user-management.e2e.test.ts:449` asserts `toContain('not an admin')`; only an `ERRCODE = '42501'` was added, so a denial is 401/403 rather than 500.
- Backwards compatible: no signature changed, so no `DROP FUNCTION` (BP-12) and the admin portal's named-argument calls are untouched.

### How the bodies were patched

The four admin bodies are 60–200 lines of PII SQL. Rewriting them by hand to change one line would have been the larger risk, so the migration patches the **predicate only**, in place, using `pg_get_functiondef` + a `replace()` anchored on the full expression, with fail-loud guards (BP-90): refuse to guess if the anchor is absent, refuse if the old predicate survives, refuse if the new one is absent, refuse if the body shrank. Every other byte — including the whole PII projection — is preserved verbatim.

---

## 2 · Part 2 — what shipped

| File | What it does |
|---|---|
| `supabase/migrations/20260918050000_fix_task_62_admin_read_and_anon_function_lockdown.sql` | BLOCK 1 gates the 4 admin read signatures in place + pins `search_path` + re-asserts grants. BLOCK 1b fixes a pre-existing runtime defect (below). BLOCK 2 locks `setup_user_profile` to `service_role` with an identity gate. BLOCK 3 removes anonymous access from `profiles_with_auth` and `debug_auth_context()`. |
| `supabase/migrations/20260918050001_fix_task_62_anon_policy_alignment.sql` | Drops all 13 `*_anon_*` policies (+ the `sp_wallets`/`sp_ledger` siblings as a class sweep), replaces the two **PUBLIC-role** `profiles` read policies with `authenticated` + `service_role` ones, and tightens the 3 loose predicates (`badges` update, `user_badges` read, `profiles` insert). |
| `supabase/migrations/20260916000077_admin_user_management.sql` *(edited)* | Creator-side fix for the `admin_get_user_analytics` defect (BLOCK 1b's counterpart), per BP-96 "fix it at the creator". |
| `p2p-kids-marketplace/scripts/qa/fix-task-62-anon-access-lockdown.mjs` *(new)* | Live probe: 20 legs, modelled on the FIX-59 probe. |
| `p2p-kids-marketplace/package.json` *(edited)* | `qa:fix62-anon-lockdown` script. |

### Deliberately NOT touched (direction discipline, BP-100)

- **`admin_config`** — its anon SELECT is load-bearing: `p2p-kids-web/lib/publicConfig.ts:52` reads pricing/trial copy with the anon key. Verified still present after both migrations.
- **`support_messages`** — the mobile app has a real **guest** path (`ContactSupportScreen.tsx`, `isGuest = !session`, then insert). Verified still present.
- **`admin_has_role(uuid)`** — granted to `anon` (`20260903000001:622`). It is a read-only boolean check referenced inside RLS policy expressions, which must be executable by the *querying* role; revoking anonymous EXECUTE could turn a clean "0 rows" into "permission denied for function". Left as-is and reported as a residual.

### Caller analysis (why nothing legitimate breaks)

- `admin_get_user_detail` → `p2p-kids-admin/src/app/api/admin/users/[id]/route.ts:35`
- `admin_get_user_analytics` → `.../users/analytics/route.ts:29`
- `admin_list_users` → `.../users/route.ts:52` (9-parameter overload, `p_sort_by`/`p_sort_order`)
  All three resolve `supabase.auth.getUser()` first and 401 when absent, then pass `p_admin_id: user.id` — i.e. the admin's own user JWT. Unchanged.
- `setup_user_profile` → **zero callers**. No Edge Function references it; the mobile `setupUserProfile` writes `profiles` over PostgREST directly with the user's own JWT. The only other references are jest mocks of the *TS* function.
- Anonymous reads needed by nobody: `p2p-kids-web` reads only `admin_config`; the mobile app gates discovery on a session (`DiscoverScreen.tsx:1276`); the integration/E2E suites are built on "anon key **+ user JWT**".

---

## 3 · Scope addition — `admin_get_user_analytics` is broken in the chain (found by BP-90)

BP-90 requires **invoking** a patched object immediately, because a successful `CREATE OR REPLACE` proves nothing. That step surfaced a defect unrelated to authorization:

```
ERROR: missing FROM-clause entry for table "s"
CONTEXT: PL/pgSQL function admin_get_user_analytics(uuid) line 13 at SQL statement
```

The `subscription_breakdown` aggregate referenced `s.status` — an alias owned by the **inner** subquery, out of scope in the outer aggregate. Effect: **every call fails**, so the admin portal's `/api/admin/users/analytics` route is broken on any database built from this chain.

**Attribution (not this task's doing):**

| Revision | Aggregate | Verdict |
|---|---|---|
| `20260328000024_fix_admin_get_user_analytics_alias_scope.sql:71` | `jsonb_object_agg(sub.status, sub.cnt)` | correct |
| `20260916000077_admin_user_management.sql:230` | `jsonb_object_agg(COALESCE(s.status, 'none'), cnt)` | **regressed** |

So a later file overwrote an earlier fix, and the schema-fidelity gate cannot see it — it fingerprints shape, never the body (`prosrc` is BP-100's named blind spot). Fixed in **both** places (creator + an idempotent convergence patch in BLOCK 1b, mirroring the earlier correct form), then verified by invocation:

```
analytics -> {"dau": 0, "mau": 0, "total_users": 1, "active_users": 1, "deleted_users": 0,
              "new_this_month": 1, "suspended_users": 0, "subscription_breakdown": {"none": 1}}
```

Rollback is one line inside each migration's header.

**Still to decide (owner):** whether staging's own body is also broken. The chain's version now is correct; staging's body came from a different history and needs one approval-gated live read of `pg_get_functiondef(…)` to compare. This is part of the paused Part 3.

---

## 4 · Verification — what was actually executed

All DB statements ran against a **local database rebuilt from the whole chain** (`node scripts/migrations/replay-probe.mjs`), never against staging.

### 4.1 Chain rebuild (Tier 2 equivalent, per the paused Option-A question)

```
migrations : 543 files in supabase/migrations
pass 1: applied 543, deferred 0
applied    : 543/543
unresolved : 0
```

A `deferred 0` / `unresolved 0` single pass is what `supabase db reset` would require. Because BLOCK 1 and BLOCK 1b both `RAISE EXCEPTION` when their anchors are absent, this run also proves the anchored patches matched on the rebuilt chain.

### 4.2 Live ACL + body read (the anti-BP-79 leg)

```
admin_get_user_analytics | p_admin_id uuid                              | gated=t old=f anon=f auth=t svc=t search_path=public
admin_get_user_detail    | p_admin_id uuid, p_user_id uuid              | gated=t old=f anon=f auth=t svc=t search_path=public
admin_list_users         | p_admin_id …, p_page integer, p_page_size … | gated=t old=f anon=f auth=t svc=t search_path=public
admin_list_users         | p_admin_id …, p_sort_by text, p_sort_order… | gated=t old=f anon=f auth=t svc=t search_path=public
setup_user_profile       | p_user_id uuid, p_display_name text, …      | anon=f auth=f svc=t  gate=t  search_path=public
profiles_with_auth anon SELECT: false
debug_auth_context anon EXECUTE: false
award_challenge_sp | anon=f auth=f
extend_trial_period | anon=f auth=f
refund_sp_for_cancelled_trade | anon=f auth=f
```

`anon=f` on all four signatures is the load-bearing result: it proves the `REVOKE … FROM PUBLIC, anon` actually took effect and did **not** silently no-op against the inherited PUBLIC grant (the BP-79 trap that cost FIX-Task-59 a round).

### 4.3 BP-90 — invoke the patched objects

`SET LOCAL ROLE service_role` against a throwaway local admin fixture (rolled back):

```
analytics -> {"subscription_breakdown": {"none": 1}, "total_users": 1, …}
list(9arg) -> {"page": 1, "total": 1, "users": [{"id": "bdc96f3c-…", "name": "fix62-admin", …}]}
detail     -> {"badges": null, "identity": {"name": "fix62-admin", "email": "fix62-admin@local.test", …}}
setup_user_profile -> {"id": "bdc96f3c-…", "name": "x", …}
```

All four bodies execute; residue afterwards `auth.users=0 rbac=0`.

### 4.4 Policy outcomes

- **No `anon`-role policies remain on user data.** The only anon policies left are the legitimate ones: `faq_items_anon_read_published`, `subscription_features_select_public`, `subscription_tiers_select_public`, `support_messages_insert_anon` (`user_id IS NULL AND contact_email IS NOT NULL` — the guest path).
- Tightened: `badges."Admins can update badges"` → `user_has_role(auth.uid(),'admin')`; `user_badges."Service role can read all user badges"` → `{authenticated}`; `profiles."Users can insert their own profile"` → `(auth.uid() = user_id)`.
- Regression guard: `admin_config.admin_config_read_all` (`{public}`, `USING true`) **still present**; `support_messages` guest INSERT **still present**.

### 4.5 Fidelity gate — 0 unexplained, and the 4 new keys are attributed

`node scripts/migrations/fidelity-check.mjs` → **136 hard findings** (subsetMisses 52, conflicts 84, unexplained 0).

Key-set diff against the FIX-Task-60 baseline (`comm -13`, the regression gate):

| New key | Attribution |
|---|---|
| `SUBSET\|POLICY\|profiles\|Public profiles are viewable` | **mine**, deliberate — `20260918050001` drops it; closes when the migration is applied to staging |
| `SUBSET\|POLICY\|profiles\|Service role can read all profiles` | **mine**, deliberate — same |
| `CONFLICT\|FUNCTION\|debug_auth_context\|` | **mine**, deliberate — I now pin `search_path=public` on it (staging has none yet); closes on apply |
| `SUBSET\|POLICY\|profiles\|Allow phone verification updates` | **not mine** — dropped by `20260918000008_fix_task_59_verify_user_phone_identity_lockdown.sql:201`, which is **another task's uncommitted work** (same attribution FIX-Task-61 recorded via a discriminating run) |

Gone (i.e. **improved**): the 3 pre-existing `search_path` conflicts on `admin_get_user_analytics`, `admin_get_user_detail` and the 7-parameter `admin_list_users` are now **closed** by this migration's `ALTER FUNCTION … SET search_path = public`.

Net: 135 → 136 keys = +4 new − 3 closed, fully explained.

### 4.6 Tier 0

- `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) → **PASS**, clean.
- `npm run lint` (`eslint . --ext .ts,.tsx`) → 656 problems (80 errors / 576 warnings), **all pre-existing** in `__tests__/**` and `detox/**`; none in a file this task touched. The new probe is `.mjs`, which the project's lint glob does not cover (`eslint scripts/qa/*.mjs` hits a pre-existing parser-config error for the FIX-59 probe too). `node --check` on the new probe → clean.

---

## 5 · Part 1 — FIX-Task-61 confirmation (no code changes)

All five items were already implemented and test-pinned before this session; nothing was outstanding in code.

| Item | Status | Where |
|---|---|---|
| 1 · Rejection UI instead of telemetry-only | DONE | `ItemCreateScreen.tsx` L676–689 (`Alert.alert` + `buildRejectedPhotoMessage`), L693–707 (thrown-batch path marks every slot failed), publish gate L1168–1173; helper `uploadFailureFormat.ts` L77/L99 |
| 2 · Publish-path contract | DONE | `listing.ts` `assertLocalImagesSatisfyContract` L151–174, called **before** the upload loop at L436; pinned by `listing-upload-images.test.ts:217+` |
| 3 · AUTH guide J02 drift | DONE (canonical only) | `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` L5, L1070, L1075 — the root + `archive/misc./` copies stay stale on purpose |
| 4 · Per-slot "couldn't upload" | DONE | `PhotoUploadManager.tsx` L22 `PHOTO_UPLOAD_FAILED_LABEL`, L139–152 `photo-slot-failed-*`, L155–167 `photo-slot-uploading-*`; inline card `photo-upload-error-card` |
| 5 · "Details" on the AI error card | DONE | `ai-error-details-toggle` L1522, `getAiErrorDetail` (`aiErrorFormat.ts:82`), reset on retry L1539 |

**Bucket-level MIME/size is not a substitute for the app-layer check** (item 2's question). The `item-images` bucket restriction was applied **out-of-band** and is not in the migration chain, so a rebuilt/local environment has no such backstop; and the app-layer contract is broader — it also enforces `MIN_PHOTO_DIMENSION` and produces the user-facing per-photo message *before* any bytes are uploaded. Keep both.

### Device re-drive — attempted, **NOT completed** (owed)

What I drove and positively established on the Android emulator (`Medium_Phone_API_36.1`, `emulator-5554`):

- App cold-launched, bundle loaded, session restored as the `test-seller` persona (2263 SP).
- `p2pkidsmarketplace://create-item` opens the **Sell sheet**; "List One Item" → **New Item** screen renders correctly: `Photos *`, `(0/10 photos)`, three empty slots, `Submit for Review` disabled, and the dev-fixture buttons.
- All three F1 fixtures are registered in MediaStore: `oversize-listing-photo.png` (37.5 MB), `unsupported-listing-photo.gif`, `valid-listing-photo.png` (1200×1200).

What did **not** work, honestly reported:

- Tapping a photo slot did **not** open the Camera/Library source modal and did **not** launch the system picker. Logcat contains **no** `[ItemCreate] Launching image library picker` line for this session, so `pickAssetsFromSource` never ran. Instead a bundled placeholder (the app logo) appeared in the slot.
- The **same build** did run the picker successfully earlier in the day (13:12, prior process): `Requesting media library permissions… → granted → Launching image library picker… → Picker result - canceled: false, assets: 1`. So the picker and its permissions are functional, and this is **not** being filed as an app defect.
- **Environment blocker:** a `@mobilenext/mobile-mcp` server from **another session** is attached to the same emulator (`pgrep`: pid 16859), and that toolset is documented to kill apps on this device via JVMTI attach. Logcat shows debugger-attach tombstones minutes before the run. Two agent sessions sharing one emulator makes this leg's output unreliable.

**Verdict:** the F1 rejection UI is **not verified on-device**. It remains owed, and per BP-91 it is enumerated rather than implied:

| Owed device leg | Action | Expected observation |
|---|---|---|
| F1-a | On an **unshared** emulator, cold launch → ItemCreate → tap slot → source modal → Library → select `oversize-listing-photo.png` (37.5 MB) + `unsupported-listing-photo.gif` | An `Alert` ("Uploads failed"/"Some uploads failed") with per-photo reasons; both slots badged **Couldn't upload** (`photo-slot-failed-*`); inline card `photo-upload-error-card` present; **Submit for Review stays blocked** with "Photo couldn't upload" |
| F1-b | Same, replacing one bad photo with `valid-listing-photo.png` | The valid photo uploads; the bad one stays badged; publish becomes possible only after removing the bad one |
| F1-c | AI error card | `ai-error-details-toggle` collapsed → tap → details text appears (blocked downstream today by the live AI provider 401) |

Evidence captured (state screenshots + the earlier-session log excerpt) is in `evidence/`.

---

## 6 · Part 3 — staging apply: PAUSED (owner decision A)

**Nothing was applied to staging.** No Supabase MCP call was made in this session.

Ready to run (all written and locally verified):

- 5 new FIX-Task-60 files (`…000003`–`…000007`) — Mode B.
- 8 FIX-Task-60 **edited** files — recommended **delta-only** apply. Only **one** of the eight (`20260916000104`) declares a migration mode; the other seven are legacy-numbered with no mode declaration, so re-running them whole against live staging is not provably safe.
- 2 FIX-Task-62 files (this task).
- The FIX-Task-62 probe (`npm run qa:fix62-anon-lockdown`) as the before/after evidence — its LEG 1/LEG 2 legs are inherently discriminating (they fail before the fix, pass after), so the pre-apply run doubles as the §9.1h RED observation.

### Why pausing was the right call — the chain is moving under the apply

Discovered mid-session, all uncommitted, all from the payout workstream:

```
?? supabase/migrations/20260918000010_fix_task_62_requeue_action_required_payouts.sql   (15:32)
?? supabase/migrations/20260918000011_fix_task_62_backfill_payout_amount_cents.sql     (15:38)
?? supabase/migrations/20260918000012_fix_task_62_gate_requeue_behind_flag.sql         (15:40)
 M supabase/config.toml
 M supabase/functions/initiate-payout/index.ts
```

The chain grew from 542 → 543 files **during** this session, and that workstream's own report states it has **already applied Fix A to staging and invoked `release-due-payouts` for real**. Two writers on one live database is the hazard; the dispatch's own "re-verify the chain immediately before applying" precondition cannot hold while this is in flight.

A fourth file (`20260918000013_fix_task_62_d2_presumed_settled_guard.sql`) appeared while this report was being written — the workstream is still active.

### The local stack is shared too — my verification cannot be re-queried right now

`docker ps` shows `supabase_db_kids_marketplace_app` **"Up 4 minutes"** while every sibling container is 6+ hours old — i.e. the database volume was **re-created by another process** after my verification run, and `public.role_based_access_control` no longer exists in it. `supabase/migrations/` is intact (544 files, no stray move-aside directory) and no probe is currently running.

Consequences, stated plainly:

- Every DB result in §4 was **captured from a valid 543/543 rebuild at the time it was run**; the artifacts (`fidelity-fix62b.json`, key sets) are committed to this directory so they remain checkable.
- Those results are **not currently re-queryable** without another full rebuild — and a rebuild started now would run against a chain the other session is still editing, and could clobber their in-flight work in turn.
- The single-line reproductions are in §8 / the migrations' headers; a rebuild on a quiet tree regenerates them in ~2 minutes (`node scripts/migrations/replay-probe.mjs`).

I deliberately did **not** re-run the rebuild: on a shared stack, that is the same "two writers" hazard in the other direction.

### Resolved: duplicate migration order keys

Two pairs of files shared a number prefix (`20260918000010`, `20260918000011`). A migration filename is an order key (BP-99), so this task's files were moved to a reserved block:

```
20260918050000_fix_task_62_admin_read_and_anon_function_lockdown.sql
20260918050001_fix_task_62_anon_policy_alignment.sql
```

The chain was re-replayed and re-gated after the rename (BP-96 rule 10): still `543/543, deferred 0, unresolved 0`, identical fidelity key sets. Each file's header documents why it is in a reserved block, so nobody "tidies" it back into a collision.

### Owner decision recorded for the batch

The owner asked for the payout workstream's three files to be **inside** the Part 3 batch. Given the pause and the finding that Fix A is already applied to staging, the recommendation is to have that workstream's own author own those three (they are mid-flight and carry their own D2 flag rationale), and to re-decide at apply time.

### `supabase db reset` — Option A: **prepared, not yet recorded**

The owner's Option A ("accept `replay-probe.mjs` as the Tier-2 equivalent-rebuild evidence; `db reset` is known-blocked by the CLI, not by content") was **not** written into the shared docs, because it is a rules change affecting every future task and it belongs to the paused Part 3. Exact wording is ready to paste into `supabase/migrations/README.md` (the `db reset` section) and one line into `.github/instructions/supabase-sql.instructions.md`. This is the first owed item.

---

## 7 · Findings and residuals

1. **`admin_get_user_analytics` was broken in the chain** (unknown `s` alias) — found by BP-90, fixed at creator + convergence, verified by invocation. **Staging's own body still needs one live read** to decide whether it was broken there too.
2. **`admin_has_role(uuid)` is anon-executable** (`20260903000001:622`). Low risk (read-only role check) and deliberately not changed — but an unauthenticated caller can probe whether a given UUID is an admin. Recommend its own task with an RLS-policy review before revoking.
3. **Signed-in users can still read every column of every profile row.** RLS is row-level and cannot restrict columns; the app only ever selects 3–4 safe columns. Column-level hardening (a narrow counterparty-profile view/RPC) is a separate task, deliberately not bundled here.
4. **The fingerprint gate still cannot see function bodies** — item 1 is a live instance of that blind spot. Recommend adding `md5(prosrc)` to `fp3-objects.sql` (also raised as a residual by FIX-Task-60).
5. **A second agent session is operating the same emulator** (`mobile-mcp`), and it is documented to kill apps there. Any future device evidence should run with that toolset detached.
6. **`debug_auth_context()`** now has a pinned `search_path`; it remains a debug helper reachable by `authenticated`.

---

## 8 · Rollback

Per-statement one-line reverts live in each migration's header:

- **Bodies** — re-apply `20260916000077_admin_user_management.sql`'s creators and `20260703000002_admin_list_users_sort_by_sp.sql` (restores the old predicate).
- **Grants** — `GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO anon;`
- **`search_path`** — `ALTER FUNCTION public.<fn>(<args>) RESET search_path;`
- **`setup_user_profile`** — `GRANT EXECUTE … TO anon, authenticated;`
- **`profiles_with_auth`** — `GRANT SELECT … TO anon;` · **`debug_auth_context`** — `GRANT EXECUTE … TO anon;`
- **Policies** — 12 of the 13 `*_anon_*` rules have a chain creator to re-apply (`20260916000093:803-857`); `items_anon_select`'s body is in `e2e-test-results/fix-task-60-2026-09-18/fidelity-exceptions.md`.
- **`admin_get_user_analytics`** — restore `COALESCE(s.status, 'none'), cnt` (re-introduces the failure on purpose; only useful to re-prove attribution).

No staging object was touched, so there is nothing to revert on staging.

---

## 9 · Evidence index

```
e2e-test-results/fix-task-62-anon-access-2026-09-18/
├── report.md                        (this file)
├── fidelity-fix62b.json             (fidelity gate output, 136 findings, unexplained 0)
├── keys-fix62b.txt                  (post-change finding key set)
├── keys-fidelity-report.txt         (FIX-Task-60 baseline key set, for the 0-NEW diff)
└── evidence/
    ├── 04-state.png                 app loaded, session restored (test-seller)
    ├── 06-itemcreate.png            create-item deep link → Sell sheet
    ├── 07-listoneitem.png           New Item screen, 0/10 photos, Submit disabled
    ├── 08-picker.png                slot tap anomaly (bundled placeholder added)
    ├── 09-now.png / 10-removed.png  strip back to 0/10
    ├── 11-sourcesheet.png           second slot tap — no source modal (the blocker)
    └── band-*.png                   device-pixel crops used for coordinate calibration
```

Local verification commands (all run, all green):

```bash
node scripts/migrations/replay-probe.mjs          # 543/543, deferred 0, unresolved 0
node scripts/migrations/fidelity-check.mjs --out=/tmp/fidelity-fix62b.json
cd p2p-kids-marketplace && npm run typecheck      # clean
```
